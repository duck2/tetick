#!/usr/bin/env python3

# hopefully inlines CSS and JS.
# this is just hacks cobbled together
# and will break if one of your files has stuff matching the REs below

import sys
import re

def usage():
	print("usage: %s <file>" % sys.argv[0])
	sys.exit()

if len(sys.argv) != 2: usage()

IN=open(sys.argv[1], "r").read()

# group(0) matches the whole tag, group(1) matches the filename.
# the patterns are not exact.
# write proper HTML so this script can survive without a HTML parser.
CSSRE="<link.*stylesheet.*href=['\"](.*\.css).*>"
JSRE="<script.*src=['\"](.*\.js).*>"

match = re.finditer(CSSRE, IN)
for m in match:
	f = "<style>" + open(m.group(1), "r").read() + "</style>"
	IN=IN.replace(m.group(0), f, 1)

match = re.finditer(JSRE, IN)
for m in match:
	f = "<script>" + open(m.group(1), "r").read() + "</script>"
	IN=IN.replace(m.group(0), f, 1)

print(IN)
