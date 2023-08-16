# Generated by Django 4.2.2 on 2023-07-06 21:12

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("registry", "0011_alter_passport_address_alter_score_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="score",
            name="status",
            field=models.CharField(
                choices=[
                    ("PROCESSING", "PROCESSING"),
                    ("BULK_PROCESSING", "BULK_PROCESSING"),
                    ("DONE", "DONE"),
                    ("ERROR", "ERROR"),
                ],
                db_index=True,
                default=None,
                max_length=20,
                null=True,
            ),
        ),
    ]
