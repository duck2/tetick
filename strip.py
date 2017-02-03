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
for cnode in cdata_raw:
	outc = {"c": cnode["c"], "n": cnode["n"]}
	outc["s"] = {snum: {"c": snode["c"], "t": convert(snode["t"])} for snum, snode in cnode["s"].iteritems() if len(snode["t"]) > 0}
	if len(outc["s"]) > 0: out.append(outc)

# look up a course ID in courses
def lookup(id):
	for i, cnode in enumerate(out):
		if cnode["c"] == id: return i

musts = {}
for dept in musts_raw:
	musts[dept] = {}
	for term in musts_raw[dept]:
		musts[dept][term] = [lookup(id) for id in musts_raw[dept][term] if lookup(id)]

a = """
window.cdata = %s;
window.musts = %s;
""" % (json.dumps(out), json.dumps(musts))

with open("data.js", "w") as f:
	f.write(a)

print "wrote %d bytes to data.js" % os.path.getsize("data.js")
