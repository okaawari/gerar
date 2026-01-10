require('dotenv').config();
const prisma = require('../src/lib/prisma');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function seedFromFile(seedData) {
    console.log('📂 Seeding from exported data file...\n');
    console.log(`📅 Data exported at: ${seedData.exportedAt}\n`);

    // Track old ID to new ID mappings for relationships
    const userIdMap = new Map();
    const categoryIdMap = new Map();
    const productIdMap = new Map();
    const addressIdMap = new Map();
    const orderIdMap = new Map();

    try {
        // 1. Seed Users
        console.log('👤 Seeding users...');
        for (const user of seedData.users) {
            const oldId = user.id;
            const { id, createdAt, updatedAt, ...userData } = user;
            
            const newUser = await prisma.user.upsert({
                where: { phoneNumber: user.phoneNumber },
                update: userData,
                create: userData
            });
            userIdMap.set(oldId, newUser.id);
            console.log(`  ✅ User: ${user.phoneNumber} (ID: ${oldId} → ${newUser.id})`);
        }

        // 2. Seed Categories (first pass: parent categories only)
        console.log('\n📁 Seeding categories (parents first)...');
        const parentCategories = seedData.categories.filter(c => !c.parentId);
        const childCategories = seedData.categories.filter(c => c.parentId);

        for (const category of parentCategories) {
            const oldId = category.id;
            const { id, createdAt, updatedAt, ...categoryData } = category;
            
            // For parent categories (parentId is null), use findFirst + create/update
            let newCategory = await prisma.category.findFirst({
                where: {
                    name: category.name,
                    parentId: null
                }
            });
            
            if (newCategory) {
                newCategory = await prisma.category.update({
                    where: { id: newCategory.id },
                    data: categoryData
                });
            } else {
                newCategory = await prisma.category.create({
                    data: categoryData
                });
            }
            
            categoryIdMap.set(oldId, newCategory.id);
            console.log(`  ✅ Category: ${category.name} (ID: ${oldId} → ${newCategory.id})`);
        }

        // 3. Seed Child Categories
        console.log('\n📁 Seeding subcategories...');
        for (const category of childCategories) {
            const oldId = category.id;
            const oldParentId = category.parentId;
            const newParentId = categoryIdMap.get(oldParentId);
            
            if (!newParentId) {
                console.warn(`  ⚠️  Skipping category ${category.name}: parent ID ${oldParentId} not found`);
                continue;
            }

            const { id, createdAt, updatedAt, ...categoryData } = category;
            categoryData.parentId = newParentId;
            
            const newCategory = await prisma.category.upsert({
                where: {
                    name_parentId: {
                        name: category.name,
                        parentId: newParentId
                    }
                },
                update: categoryData,
                create: categoryData
            });
            categoryIdMap.set(oldId, newCategory.id);
            console.log(`  ✅ Subcategory: ${category.name} (ID: ${oldId} → ${newCategory.id})`);
        }

        // 4. Seed Products
        console.log('\n📦 Seeding products...');
        for (const product of seedData.products) {
            const oldId = product.id;
            const { id, createdAt, updatedAt, ...productData } = product;
            productData.price = parseFloat(productData.price);
            productData.originalPrice = productData.originalPrice ? parseFloat(productData.originalPrice) : null;
            
            const newProduct = await prisma.product.upsert({
                where: { id: oldId },
                update: productData,
                create: productData
            });
            productIdMap.set(oldId, newProduct.id);
            console.log(`  ✅ Product: ${product.name} (ID: ${oldId} → ${newProduct.id})`);
        }

        // 5. Seed ProductCategories
        console.log('\n🔗 Seeding product-category relationships...');
        for (const pc of seedData.productCategories) {
            const oldProductId = pc.productId;
            const oldCategoryId = pc.categoryId;
            const newProductId = productIdMap.get(oldProductId);
            const newCategoryId = categoryIdMap.get(oldCategoryId);

            if (!newProductId || !newCategoryId) {
                console.warn(`  ⚠️  Skipping ProductCategory: product ${oldProductId} or category ${oldCategoryId} not found`);
                continue;
            }

            const { id, createdAt, ...pcData } = pc;
            pcData.productId = newProductId;
            pcData.categoryId = newCategoryId;

            await prisma.productCategory.upsert({
                where: {
                    productId_categoryId: {
                        productId: newProductId,
                        categoryId: newCategoryId
                    }
                },
                update: pcData,
                create: pcData
            });
        }
        console.log(`  ✅ Created ${seedData.productCategories.length} product-category relationships`);

        // 6. Seed Addresses
        console.log('\n📍 Seeding addresses...');
        for (const address of seedData.addresses) {
            const oldId = address.id;
            const oldUserId = address.userId;
            const newUserId = userIdMap.get(oldUserId);

            if (!newUserId) {
                console.warn(`  ⚠️  Skipping address: user ID ${oldUserId} not found`);
                continue;
            }

            const { id, createdAt, updatedAt, ...addressData } = address;
            addressData.userId = newUserId;

            const newAddress = await prisma.address.upsert({
                where: { id: oldId },
                update: addressData,
                create: addressData
            });
            addressIdMap.set(oldId, newAddress.id);
            console.log(`  ✅ Address: ${address.label || address.fullName} (ID: ${oldId} → ${newAddress.id})`);
        }

        // 7. Seed CartItems
        console.log('\n🛒 Seeding cart items...');
        let cartItemsCreated = 0;
        for (const cartItem of seedData.cartItems) {
            const oldUserId = cartItem.userId;
            const oldProductId = cartItem.productId;
            const newUserId = userIdMap.get(oldUserId);
            const newProductId = productIdMap.get(oldProductId);

            if (!newUserId || !newProductId) {
                console.warn(`  ⚠️  Skipping cart item: user ${oldUserId} or product ${oldProductId} not found`);
                continue;
            }

            const { id, createdAt, updatedAt, ...cartItemData } = cartItem;
            cartItemData.userId = newUserId;
            cartItemData.productId = newProductId;

            await prisma.cartItem.upsert({
                where: {
                    userId_productId: {
                        userId: newUserId,
                        productId: newProductId
                    }
                },
                update: cartItemData,
                create: cartItemData
            });
            cartItemsCreated++;
        }
        console.log(`  ✅ Created ${cartItemsCreated} cart items`);

        // 8. Seed Orders
        console.log('\n📋 Seeding orders...');
        for (const order of seedData.orders) {
            const oldId = order.id;
            const oldUserId = order.userId;
            const newUserId = userIdMap.get(oldUserId);

            if (!newUserId) {
                console.warn(`  ⚠️  Skipping order: user ID ${oldUserId} not found`);
                continue;
            }

            const { id, createdAt, updatedAt, ...orderData } = order;
            orderData.userId = newUserId;
            orderData.totalAmount = parseFloat(orderData.totalAmount);
            
            // Map address ID if exists
            if (orderData.addressId) {
                const oldAddressId = orderData.addressId;
                const newAddressId = addressIdMap.get(oldAddressId);
                if (newAddressId) {
                    orderData.addressId = newAddressId;
                } else {
                    console.warn(`  ⚠️  Order ${oldId}: address ${oldAddressId} not found, setting to null`);
                    orderData.addressId = null;
                }
            }

            const newOrder = await prisma.order.create({
                data: orderData
            });
            orderIdMap.set(oldId, newOrder.id);
            console.log(`  ✅ Order: ID ${oldId} → ${newOrder.id}`);
        }

        // 9. Seed OrderItems
        console.log('\n📦 Seeding order items...');
        let orderItemsCreated = 0;
        for (const orderItem of seedData.orderItems) {
            const oldOrderId = orderItem.orderId;
            const oldProductId = orderItem.productId;
            const newOrderId = orderIdMap.get(oldOrderId);
            const newProductId = productIdMap.get(oldProductId);

            if (!newOrderId || !newProductId) {
                console.warn(`  ⚠️  Skipping order item: order ${oldOrderId} or product ${oldProductId} not found`);
                continue;
            }

            const { id, createdAt, updatedAt, ...orderItemData } = orderItem;
            orderItemData.orderId = newOrderId;
            orderItemData.productId = newProductId;
            orderItemData.price = parseFloat(orderItemData.price);

            await prisma.orderItem.create({
                data: orderItemData
            });
            orderItemsCreated++;
        }
        console.log(`  ✅ Created ${orderItemsCreated} order items`);

        // 10. Seed Favorites
        console.log('\n❤️ Seeding favorites...');
        let favoritesCreated = 0;
        for (const favorite of seedData.favorites) {
            const oldUserId = favorite.userId;
            const oldProductId = favorite.productId;
            const newUserId = userIdMap.get(oldUserId);
            const newProductId = productIdMap.get(oldProductId);

            if (!newUserId || !newProductId) {
                console.warn(`  ⚠️  Skipping favorite: user ${oldUserId} or product ${oldProductId} not found`);
                continue;
            }

            const { id, createdAt, ...favoriteData } = favorite;
            favoriteData.userId = newUserId;
            favoriteData.productId = newProductId;

            await prisma.favorite.upsert({
                where: {
                    userId_productId: {
                        userId: newUserId,
                        productId: newProductId
                    }
                },
                update: {},
                create: favoriteData
            });
            favoritesCreated++;
        }
        console.log(`  ✅ Created ${favoritesCreated} favorites`);

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 Seeding Summary:');
        console.log('='.repeat(50));
        console.log(`✅ Users: ${seedData.users.length}`);
        console.log(`✅ Categories: ${seedData.categories.length}`);
        console.log(`✅ Products: ${seedData.products.length}`);
        console.log(`✅ ProductCategories: ${seedData.productCategories.length}`);
        console.log(`✅ Addresses: ${seedData.addresses.length}`);
        console.log(`✅ CartItems: ${cartItemsCreated}`);
        console.log(`✅ Orders: ${seedData.orders.length}`);
        console.log(`✅ OrderItems: ${orderItemsCreated}`);
        console.log(`✅ Favorites: ${favoritesCreated}`);
        console.log('\n' + '='.repeat(50));
        console.log('🎉 Database seeding from file completed successfully!');
        console.log('='.repeat(50) + '\n');

    } catch (error) {
        console.error('❌ Error seeding from file:', error);
        throw error;
    }
}

async function seedDefault() {
    console.log('🌱 Starting default database seeding...\n');

    // 1. Create Admin User
    console.log('👤 Creating admin user...');
    const hashedPin = await bcrypt.hash('1234', 10);
    const admin = await prisma.user.upsert({
        where: { phoneNumber: '12345678' },
        update: {},
        create: {
            phoneNumber: '12345678',
            email: 'admin@example.com',
            pin: hashedPin,
            name: 'Admin User',
            role: 'ADMIN'
        }
    });
    console.log('✅ Admin user created:', admin.phoneNumber);

    // 2. Create Test User
    console.log('\n👤 Creating test user...');
    const testUser = await prisma.user.upsert({
        where: { phoneNumber: '87654321' },
        update: {},
        create: {
            phoneNumber: '87654321',
            email: 'user@example.com',
            pin: hashedPin,
            name: 'Test User',
            role: 'USER'
        }
    });
    console.log('✅ Test user created:', testUser.phoneNumber);

    // 3. Create Main Category: Household & Personal Care
    console.log('\n📁 Creating main category: Household & Personal Care...');
    let householdCategory = await prisma.category.findFirst({
        where: { 
            name: 'Гэр ахуйн бараа',
            parentId: null 
        }
    });

    if (!householdCategory) {
        householdCategory = await prisma.category.create({
            data: {
                name: 'Гэр ахуйн бараа',
                description: 'Гэр ахуйн бараа бүтээгдэхүүнүүд',
                parentId: null
            }
        });
        console.log('✅ Created main category:', householdCategory.name);
    } else {
        console.log('✅ Main category already exists:', householdCategory.name);
    }

    // 4. Create Subcategories
    console.log('\n📁 Creating subcategories...');
    
    const subcategories = [
        {
            name: 'Гал тогоо',
            description: 'Гал тогооны хэрэгслүүд',
            products: [
                { name: 'Хатаагч', description: 'Аяга таваг хатаах хэрэгсэл', price: 25000, stock: 50 },
                { name: 'Аяга таваг', description: 'Гарын аяга таваг', price: 15000, stock: 100 },
                { name: 'Сармагчин', description: 'Хоол хийх сармагчин', price: 35000, stock: 30 },
                { name: 'Хутга багц', description: 'Гал тогооны хутга багц', price: 45000, stock: 40 }
            ]
        },
        {
            name: 'Цэвэрлэгээ',
            description: 'Гэрийн цэвэрлэгээний бүтээгдэхүүн',
            products: [
                { name: 'Гэрийн цэвэрлэгээний шингэн', description: 'Олон зориулалттай цэвэрлэгээний шингэн', price: 8000, stock: 75 },
                { name: 'Шал цэвэрлэгээний бодис', description: 'Шал цэвэрлэхэд зориулсан бодис', price: 6000, stock: 60 },
                { name: 'Ариутгалтын бодис', description: 'Гадаргуу ариутгах бодис', price: 12000, stock: 45 },
                { name: 'Гоо сайхны алчуур', description: 'Гоо сайхны алчуур багц', price: 5000, stock: 120 }
            ]
        },
        {
            name: 'Хадгална',
            description: 'Хоол ундаа хадгалах хэрэгсэл',
            products: [
                { name: 'Хадгалах саван', description: 'Хоол хадгалах саван', price: 3500, stock: 200 },
                { name: 'Вакуум уут', description: 'Вакуум хадгалах уут', price: 12000, stock: 80 },
                { name: 'Хөлдөөгч саван', description: 'Хөлдөөгч дотор ашиглах саван', price: 4500, stock: 150 },
                { name: 'Хадгалах уут багц', description: 'Олон зориулалттай хадгалах уут', price: 8000, stock: 100 }
            ]
        },
        {
            name: 'Гоо сайхан',
            description: 'Гоо сайхны бүтээгдэхүүн',
            products: [
                { name: 'Гар угаах саван', description: 'Гоо сайхны гар угаах саван', price: 3500, stock: 150 },
                { name: 'Шүдний сойз', description: 'Эрүүл шүдний сойз', price: 2500, stock: 200 },
                { name: 'Шүдний оо', description: 'Фтортой шүдний оо', price: 4500, stock: 180 },
                { name: 'Гарын крем', description: 'Чийгшүүлэх гарын крем', price: 5500, stock: 120 }
            ]
        },
        {
            name: 'Гэрэлтүүлэг',
            description: 'Гэрийн гэрэлтүүлэг',
            products: [
                { name: 'LED чийдэн', description: 'Эрчим хүч хэмнэдэг LED чийдэн', price: 8000, stock: 90 },
                { name: 'Гадаад чийдэн', description: 'Гадаад ашиглах чийдэн', price: 15000, stock: 50 },
                { name: 'Гэрэлтүүлэг багц', description: 'Гэрийн гэрэлтүүлэг багц', price: 25000, stock: 30 }
            ]
        },
        {
            name: 'Тавилга',
            description: 'Гэрийн тавилга',
            products: [
                { name: 'Ширээ', description: 'Оффисын ширээ', price: 85000, stock: 20 },
                { name: 'Сандал', description: 'Тохилог сандал', price: 45000, stock: 35 },
                { name: 'Тавиур', description: 'Ном тавиур', price: 65000, stock: 25 }
            ]
        }
    ];

    const createdSubcategories = [];
    for (const subcat of subcategories) {
        let category = await prisma.category.findFirst({
            where: {
                name: subcat.name,
                parentId: householdCategory.id
            }
        });

        if (!category) {
            category = await prisma.category.create({
                data: {
                    name: subcat.name,
                    description: subcat.description,
                    parentId: householdCategory.id
                }
            });
            console.log(`  ✅ Created subcategory: ${category.name}`);
        } else {
            console.log(`  ℹ️  Subcategory already exists: ${category.name}`);
        }
        createdSubcategories.push({ category, products: subcat.products });
    }

    // 5. Create Products
    console.log('\n📦 Creating products...');
    let totalProducts = 0;
    
    for (const { category, products } of createdSubcategories) {
        for (const product of products) {
            const existingProduct = await prisma.product.findFirst({
                where: {
                    name: product.name
                }
            });

            if (!existingProduct) {
                const newProduct = await prisma.product.create({
                    data: {
                        name: product.name,
                        description: product.description,
                        price: product.price,
                        stock: product.stock
                    }
                });
                
                // Link product to category via ProductCategory
                await prisma.productCategory.create({
                    data: {
                        productId: newProduct.id,
                        categoryId: category.id,
                        order: 0
                    }
                });
                
                console.log(`  ✅ Created product: ${product.name} (${category.name})`);
                totalProducts++;
            } else {
                console.log(`  ℹ️  Product already exists: ${product.name}`);
            }
        }
    }

    console.log(`\n✅ Created ${totalProducts} new products`);

    // 6. Create Sample Address for Test User
    console.log('\n📍 Creating sample address for test user...');
    const existingAddress = await prisma.address.findFirst({
        where: { userId: testUser.id }
    });

    if (!existingAddress) {
        const address = await prisma.address.create({
            data: {
                userId: testUser.id,
                label: 'Home',
                fullName: 'Test User',
                phoneNumber: testUser.phoneNumber,
                provinceOrDistrict: 'Ulaanbaatar',
                khorooOrSoum: 'Bayangol',
                street: 'Peace Avenue',
                neighborhood: 'Downtown',
                building: 'Building 5',
                apartmentNumber: 'Apt 12B',
                addressNote: 'Call when arrived',
                isDefault: true
            }
        });
        console.log('✅ Created sample address');
    } else {
        console.log('ℹ️  Address already exists for test user');
    }

    // 7. Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Seeding Summary:');
    console.log('='.repeat(50));
    
    const categoryCount = await prisma.category.count();
    const productCount = await prisma.product.count();
    const userCount = await prisma.user.count();
    const addressCount = await prisma.address.count();

    console.log(`✅ Categories: ${categoryCount}`);
    console.log(`✅ Products: ${productCount}`);
    console.log(`✅ Users: ${userCount}`);
    console.log(`✅ Addresses: ${addressCount}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Database seeding completed successfully!');
    console.log('='.repeat(50));
    console.log('\n📝 Test Credentials:');
    console.log('Admin - Phone: 12345678, PIN: 1234');
    console.log('User  - Phone: 87654321, PIN: 1234');
    console.log('\n');
}

async function main() {
    const seedDataPath = path.join(__dirname, 'seed-data.json');
    
    if (fs.existsSync(seedDataPath)) {
        console.log('📂 Found seed-data.json file, loading exported data...\n');
        const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
        await seedFromFile(seedData);
    } else {
        console.log('📝 No seed-data.json found, using default seed data...\n');
        await seedDefault();
    }
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
