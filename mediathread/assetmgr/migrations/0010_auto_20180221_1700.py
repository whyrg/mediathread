# -*- coding: utf-8 -*-
# Generated by Django 1.11.10 on 2018-02-21 17:00
from __future__ import unicode_literals

from os.path import basename, splitext
from django.db import migrations


def fix_permalinks(sources):
    for source in sources:
        filename = basename(source.url)
        if splitext(filename)[1] == '':
            # This is a broken permalink. Fix it.
            permalink = 'https://digitaltibet.ctl.columbia.edu/' + \
                        'object/{}/'.format(filename.replace('_', '-'))
            source.url = permalink
            source.save()


def overwrite_with_primary_sources(Source, sources):
    for source in sources:
        # Find the primary source's url, and use that one.
        primary_source = Source.objects.get(primary=True, asset=source.asset)
        source.url = primary_source.url
        source.save()


def update_all_dtibet_urls(apps, schema_editor):
    Source = apps.get_model('assetmgr', 'Source')

    sources_with_possibly_bad_permalinks = Source.objects.filter(
        url__startswith='https://s3.amazonaws.com/'
        'ccnmtl-digitaltibet-static-prod/objects/')
    fix_permalinks(sources_with_possibly_bad_permalinks)

    bad_sources = Source.objects.filter(
        url='https://s3.amazonaws.com/ccnmtl-digitaltibet-static-prod/'
        'objects/x${x}.png')
    overwrite_with_primary_sources(Source, bad_sources)


class Migration(migrations.Migration):

    dependencies = [
        ('assetmgr', '0009_auto_20180201_1424'),
    ]

    operations = [
        migrations.RunPython(update_all_dtibet_urls),
    ]
