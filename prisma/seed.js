require('dotenv').config();
const prisma = require('../src/lib/prisma');
const bcrypt = require('bcrypt');

async function main() {
    console.log('🌱 Starting database seeding...\n');

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
                    name: product.name,
                    categoryId: category.id
                }
            });

            if (!existingProduct) {
                await prisma.product.create({
                    data: {
                        name: product.name,
                        description: product.description,
                        price: product.price,
                        stock: product.stock,
                        categoryId: category.id
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

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
