import os
import json

# eats data.json, musts.json and spits out a stripped data.js
# see data_spec.md:/^while/ for how it does

cdata_raw = json.load(open("data.json", "r"))
musts_raw = json.load(open("musts.json", "r"))

# convert times in a "t": node
def tomins(clock):
	split = clock.split(":")
	return int(split[0]) * 60 + int(split[1])
def convert(tarr):
	return [{"d": tnode["d"], "p": tnode["p"], "s": tomins(tnode["s"]), "e": tomins(tnode["e"])} for tnode in tarr]

out = []
# ALL AA-ZZ constraint is effectively no constraint. so remove all constraints if it's present.
def filterc(cs):
	for c in cs:
		if c["s"] == "AA" and c["e"] == "ZZ" and c["d"] == "ALL":
			return []
	return cs

ins_set = set()
for cnode in cdata_raw:
	for snode in cnode["s"].values():
		ins_set.update(snode["i"])

ins = list(ins_set)
ins_map = {k: v for v, k in enumerate(ins)}

for cnode in cdata_raw:
	outc = {"c": cnode["c"], "n": cnode["n"]}
	outc["s"] = {snum: {"c": filterc(snode["c"]), "i": [ins_map[ins] for ins in snode["i"]], "t": convert(snode["t"])} for snum, snode in cnode["s"].items() if len(snode["t"]) > 0}
	if len(outc["s"]) > 0: out.append(outc)

# look up a course ID in courses
def lookup(id):
	for i, cnode in enumerate(out):
		if cnode["c"] == id: return i

musts = {}
for dept in musts_raw:
	musts[dept] = {}
	for term in musts_raw[dept]:
		musts[dept][term] = [lookup(id) for id in musts_raw[dept][term] if lookup(id) is not None]

# it takes some work to read last modification time, convert to UTC and
# strftime it out
import pytz
from datetime import datetime
from tzlocal import get_localzone

tz = get_localzone()
mod = datetime.fromtimestamp(os.path.getmtime("data.json"))
fdate = tz.localize(mod).astimezone(pytz.utc).strftime("%d %b %Y %H:%M UTC")

a = """
window.fdate = \"%s\";
window.idata = %s;
window.cdata = %s;
window.musts = %s;
""" % (fdate, json.dumps(ins), json.dumps(out), json.dumps(musts))

with open("data.js", "w") as f:
	f.write(a)

print("wrote %d bytes to data.js" % os.path.getsize("data.js"))
