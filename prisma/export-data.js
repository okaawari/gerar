require('dotenv').config();
const prisma = require('../src/lib/prisma');
const fs = require('fs');
const path = require('path');

async function exportData() {
    console.log('📤 Starting data export...\n');

    try {
        // Export all data from each table
        console.log('📦 Exporting Users...');
        const users = await prisma.user.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${users.length} users`);

        console.log('\n📁 Exporting Categories...');
        const categories = await prisma.category.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${categories.length} categories`);

        console.log('\n📦 Exporting Products...');
        const products = await prisma.product.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${products.length} products`);

        console.log('\n🔗 Exporting ProductCategories...');
        const productCategories = await prisma.productCategory.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${productCategories.length} product-category relationships`);

        console.log('\n📍 Exporting Addresses...');
        const addresses = await prisma.address.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${addresses.length} addresses`);

        console.log('\n🛒 Exporting CartItems...');
        const cartItems = await prisma.cartItem.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${cartItems.length} cart items`);

        console.log('\n📋 Exporting Orders...');
        const orders = await prisma.order.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${orders.length} orders`);

        console.log('\n📦 Exporting OrderItems...');
        const orderItems = await prisma.orderItem.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${orderItems.length} order items`);

        console.log('\n❤️ Exporting Favorites...');
        const favorites = await prisma.favorite.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Exported ${favorites.length} favorites`);

        // Prepare data object
        // Convert Decimal types to strings for JSON serialization
        const exportData = {
            exportedAt: new Date().toISOString(),
            users: users.map(u => ({
                ...u,
                pin: u.pin // Keep hashed PIN as-is
            })),
            categories: categories,
            products: products.map(p => ({
                ...p,
                price: p.price.toString(),
                originalPrice: p.originalPrice ? p.originalPrice.toString() : null,
                images: p.images
            })),
            productCategories: productCategories,
            addresses: addresses,
            cartItems: cartItems,
            orders: orders.map(o => ({
                ...o,
                totalAmount: o.totalAmount.toString()
            })),
            orderItems: orderItems.map(oi => ({
                ...oi,
                price: oi.price.toString()
            })),
            favorites: favorites
        };

        // Write to JSON file
        const exportPath = path.join(__dirname, 'seed-data.json');
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');

        console.log('\n' + '='.repeat(50));
        console.log('📊 Export Summary:');
        console.log('='.repeat(50));
        console.log(`✅ Users: ${users.length}`);
        console.log(`✅ Categories: ${categories.length}`);
        console.log(`✅ Products: ${products.length}`);
        console.log(`✅ ProductCategories: ${productCategories.length}`);
        console.log(`✅ Addresses: ${addresses.length}`);
        console.log(`✅ CartItems: ${cartItems.length}`);
        console.log(`✅ Orders: ${orders.length}`);
        console.log(`✅ OrderItems: ${orderItems.length}`);
        console.log(`✅ Favorites: ${favorites.length}`);
        console.log('\n' + '='.repeat(50));
        console.log(`✅ Data exported successfully to: ${exportPath}`);
        console.log('='.repeat(50));
        console.log('\n⚠️  Note: User PINs are exported as hashed values.');
        console.log('   They will be re-seeded as-is. For plain text PINs,');
        console.log('   you would need to update the seed file manually.\n');

    } catch (error) {
        console.error('❌ Error exporting data:', error);
        throw error;
    }
}

exportData()
    .catch((e) => {
        console.error('❌ Export failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
