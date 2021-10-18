#!/usr/bin/env python3

# hopefully inlines CSS, JS and WOFF2.
# this is just hacks cobbled together
# and will break if one of your files has stuff matching the REs below

import base64
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
	IN = IN.replace(m.group(0), f, 1)

match = re.finditer(JSRE, IN)
for m in match:
	f = "<script>" + open(m.group(1), "r").read() + "</script>"
	IN = IN.replace(m.group(0), f, 1)

# now inline woff2 font into inlined css
WOFF2RE="src: url\('(.*\.woff2)'\);"

match = re.finditer(WOFF2RE, IN)
for m in match:
	b = base64.standard_b64encode(open(m.group(1), "rb").read()).decode("utf-8")
	f = "src: url(data:font/woff2;charset=utf-8;base64,%s) format('woff2');" % b
	IN = IN.replace(m.group(0), f, 1)

print(IN)
