# Generated by Django 3.2.15 on 2022-09-14 20:26

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('structuredcollaboration', '0007_auto_20200710_1336'),
    ]

    operations = [
        migrations.AddField(
            model_name='collaboration',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='collaboration',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
