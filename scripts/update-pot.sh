#!/bin/bash
#This script scans the source code for any translatable strings and updates the po/messages.pot file accordingly

#Change to repository root and exit on failure
set -e
cd "$( cd "$( dirname "$0" )" && pwd )/.." || exit 1

#Update the template file with the strings from the source files
echo "Generating 'messages.pot'..."
xgettext --from-code=UTF-8 \
         --add-comments=Translators \
         --copyright-holder="Lorenzo Carbonell" \
         --package-name="battery-status@atareao.es" \
         --output=po/messages.pot \
         -- *.js schemas/*.xml

#Replace some lines of the header with our own
sed -i '1s/.*/# <LANGUAGE> translation for the Battery Status GNOME Shell Extension./' po/messages.pot
sed -i "2s/.*/# Copyright (C) $(date +%Y) Lorenzo Carbonell/" po/messages.pot
sed -i '10s/.*/"Report-Msgid-Bugs-To: https://github.com/atareao/battery-status/issues\n"' po/messages.pot
sed -i '17s/CHARSET/UTF-8/' po/messages.pot

echo "'messages.pot' generated!"
