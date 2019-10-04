import os, re
import json
import requests

# this fetches catalog.metu.edu.tr for undergraduate curricula- "must" courses.

out_file="musts.json"

# pretend we are not a broken python script
headers = requests.utils.default_headers()
headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 7.0; Win64; x64; rv:3.0b2pre) Gecko/20110203 Firefox/4.0b12pre",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"})

# get the curriculum of a given program
s = requests.Session()
def get_curr(dept):
	return s.get("http://catalog.metu.edu.tr/program.php?fac_prog=%s" % dept,
					headers=headers).content.decode("utf-8", errors="ignore")

prefixes={'459': 'BED', '573': u'FDE', '312': u'BA', '311': u'ECON', '310': u'ADM', '454': u'EDS', '316': u'BAS', '315': u'GIA', '314': u'IR', '238': u'BIOL', '234': u'CHEM', '236': u'MATH', '230': u'PHYS', '232': u'SOC', '233': u'PSY', '797': 'EEE', '791': 'AUTO', '356': u'EEE', '453': u'PES', '799': 'ENOT', '798': u'ENEL', '450': u'FLE', '572': u'AEE', '366': u'EFL', '367': u'CHME', '364': u'CVE', '365': u'MECH', '571': u'CENG', '352': u'ECO', '568': u'IE', '569': u'ME', '570': u'METE', '351': 'BUSD', '560': u'ENVE', '561': u'ES', '562': u'CE', '563': u'CHE', '564': u'GEOE', '565': u'MINE', '566': u'PETE', '567': u'EE', '120': u'ARCH', '421': 'PHED', '246': u'STAT', '241': u'PHIL', '125': u'ID', '219': u'GENE', '422': 'CHED', '121': u'CRP', '451': u'TEFL', '378': u'GPC', '355': u'CNG', '354': u'PSIR', '353': u'BUS', '411': u'ECE', '412': 'ESE', '413': 'EME', '371': u'PSYC', '384': u'ASE', '376': u'CTE', '374': u'PNGE', '430': u'CEIT', '240': u'HIST'}

# we dice the response into semesters, cut away the elective courses
# and get the course codes with this majestic RE
ccode_prog=re.compile("course.php\?prog=[0-9]*&course_code=([0-9]*)")
out={}
for dcode in prefixes:
	text = get_curr(dcode)
	print "hit %s" % prefixes[dcode]
	raw_terms = [a.split("colspan")[0] for a in text.split("<table>")[1:]]
	node = {}
	for i, term in enumerate(raw_terms):
		node[str(i+1)] = [code for code in ccode_prog.findall(term)]
	out[prefixes[dcode]] = node

json.dump(out, open(out_file, "w"))
print "wrote %d bytes to %s" % (os.path.getsize(out_file), out_file)
