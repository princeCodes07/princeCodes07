from django.db import migrations


def create_products(apps, schema_editor):
    Category = apps.get_model('campusfriend', 'Category')
    Product = apps.get_model('campusfriend', 'Product')

    accessories, _ = Category.objects.get_or_create(name='Accessories')
    audio, _ = Category.objects.get_or_create(name='Audio')
    networking, _ = Category.objects.get_or_create(name='Networking')
    phones, _ = Category.objects.get_or_create(name='Phones')

    products = [
        {
            'name': 'Privacy Screen Protector',
            'category': accessories,
            'price': '14.99',
            'stock': 120,
            'description': 'Privacy screen protector with anti-glare finish and scratch resistance.',
            'image': '',
        },
        {
            'name': 'iPhone Charger',
            'category': accessories,
            'price': '19.99',
            'stock': 80,
            'description': 'Fast-charging iPhone wall charger with compact design and durable cable.',
            'image': '',
        },
        {
            'name': 'Phone Cable',
            'category': accessories,
            'price': '9.99',
            'stock': 200,
            'description': 'Durable phone charging cable for reliable daily use with fast sync support.',
            'image': '',
        },
        {
            'name': 'Phone Case',
            'category': accessories,
            'price': '12.99',
            'stock': 150,
            'description': 'Protective phone case with slim fit and shock-absorbent materials.',
            'image': '',
        },
        {
            'name': 'MiFi',
            'category': networking,
            'price': '49.99',
            'stock': 45,
            'description': 'Portable MiFi hotspot for on-the-go wireless internet access.',
            'image': '',
        },
        {
            'name': 'Music Box',
            'category': audio,
            'price': '29.99',
            'stock': 70,
            'description': 'Compact music box speaker with rich sound and Bluetooth connectivity.',
            'image': '',
        },
        {
            'name': 'Mouse',
            'category': accessories,
            'price': '24.99',
            'stock': 100,
            'description': 'Ergonomic wireless mouse with precise tracking and long battery life.',
            'image': '',
        },
        {
            'name': 'AirPods',
            'category': audio,
            'price': '129.99',
            'stock': 55,
            'description': 'Wireless earbuds with active noise cancellation and crisp audio quality.',
            'image': '',
        },
        {
            'name': 'AirPods Max',
            'category': audio,
            'price': '479.99',
            'stock': 25,
            'description': 'Premium over-ear headphones with immersive sound and adaptive noise control.',
            'image': '',
        },
    ]

    for item in products:
        Product.objects.update_or_create(
            name=item['name'],
            defaults={
                'category': item['category'],
                'price': item['price'],
                'stock': item['stock'],
                'description': item['description'],
                'image': item['image'],
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('campusfriend', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_products),
    ]
