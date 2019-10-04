# coding: utf-8
import os, re
import json
import requests

import codecs, sys
sys.stdout = codecs.getwriter("UTF-8")(sys.stdout)

# this scrapes oibs64 for all the course data.
# see data_spec.md for interpreting out_file.
# be aware- spits a lot of output to stdout.

out_file="data.json"

oibs_url="https://oibs2.metu.edu.tr/View_Program_Course_Details_64/main.php"

# stuff for department-izing course codes.
# a course ID like 5720172 does not become aee172 on its own.
prefixes = {'219': u'GENE', '956': u'OCEA', '450': u'FLE', '612': u'PERS', '451': u'TEFL', '810': u'GWS', '811': u'UPL', '814': u'SA', '815': u'ARS', '816': u'MCS', '817': u'FPSY', '453': u'PES', '120': u'ARCH', '121': u'CRP', '125': u'ID', '420': u'SSME', '363': u'STAS', '379': u'ARC', '378': u'GPC', '410': u'ELE', '411': u'ECE', '371': u'PSYC', '370': u'FRN', '372': u'SOCL', '821': u'ELIT', '820': u'ELT', '377': u'PHL', '822': u'ESME', '312': u'BA', '311': u'ECON', '310': u'ADM', '316': u'BAS', '315': u'GIA', '314': u'IR', '391': u'ENLT', '390': u'SEES', '832': u'MES', '833': u'EUS', '795': u'TKPR', '831': u'STPS', '837': u'EMBA', '834': u'HRDE', '835': u'EAS', '838': u'EI', '839': u'SPL', '798': u'ENEL', '368': u'EDUS', '369': u'GRM', '366': u'EFL', '367': u'CHME', '364': u'CVE', '365': u'MECH', '362': u'HST', '910': u'CSEC', '360': u'CHM', '361': u'TUR', '855': u'UD', '246': u'STAT', '384': u'ASE', '240': u'HIST', '386': u'IDS', '902': u'COGS', '901': u'IS', '843': u'LNA', '842': u'ASN', '841': u'GTSS', '840': u'SAN', '375': u'ART', '908': u'BIN', '909': u'GATE', '374': u'PNGE', '643': u'THEA', '642': u'TURK', '644': u'SLTP', '241': u'PHIL', '376': u'CTE', '430': u'CEIT', '385': u'SPN', '573': u'FDE', '572': u'AEE', '571': u'CENG', '570': u'METE', '454': u'EDS', '880': u'OR', '629': u'TFL', '854': u'BS', '853': u'CP', '856': u'CONS', '857': u'IDDI', '852': u'RP', '970': u'IAM', '858': u'ARCD', '651': u'MUS', '568': u'IE', '569': u'ME', '560': u'ENVE', '561': u'ES', '562': u'CE', '563': u'CHE', '564': u'GEOE', '565': u'MINE', '566': u'PETE', '567': u'EE', '906': u'MI', '904': u'ION', '861': u'BTEC', '860': u'BCH', '863': u'ARME', '862': u'PST', '865': u'GGIT', '864': u'ASTR', '867': u'SE', '866': u'EM', '905': u'SM', '605': u'JA', '604': u'GERM', '607': u'RUS', '606': u'ITAL', '603': u'FREN', '608': u'SPAN', '238': u'BIOL', '234': u'CHEM', '236': u'MATH', '230': u'PHYS', '232': u'SOC', '233': u'PSY', '878': u'NSNT', '876': u'MDM', '950': u'MASC', '874': u'ESS', '872': u'BME', '873': u'EQS', '870': u'CEME', '871': u'MNT', '354': u'PSIR', '639': u'ENG', '610': u'GRE', '611': u'CHN', '357': u'MAT', '356': u'EEE', '355': u'CNG', '954': u'MBIO', '353': u'BUS', '352': u'ECO', '877': u'OHS', '801': u'AH', '358': u'PHY', '359': u'ENGL', '682': u'INST', "976": "IAM", "836": "PHIL", "459": "BED", "373": "BIO", "351": "BUSD", "952": "MASC", "422": "CHED", "971": "IAM", "825": "EDS", "875": "EQS", "824": "EDS", "797": "EEE", "401": "ECE", "413": "EME", "412": "ESE", "799": "ENOT", "383": "ESC", "382": "ENV", "884": "ENVM", "973": "FM", "800": "SBE", "869": "HE", "791": "AUTO", "602": "ARAB", "951": "MASC", "421": "PHED", "972": "SC", "907": "WBLS"}
def deptify(ccode):
	a, b = ccode[:3], ccode[3:]
	if b[0] == "0": b = b[1:]
	try:
		return prefixes[a] + b
	except:
		print "WARN! I don't know what department is %s" % a
		return ""

dept_codes=[]
dept_names={}

# we need cookies and stuff, also pretend that we are firefox on windows
s = requests.Session()
headers = requests.utils.default_headers()
headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 7.0; Win64; x64; rv:3.0b2pre) Gecko/20110203 Firefox/4.0b12pre",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			"Pragma": "no-cache"})

# RE for getting course and term codes from the main page. group(1) is code, group(2) is name.
option_prog=re.compile("<option value=\"(.*)\">([^<]*)</option>")

index_text = s.get(oibs_url, headers=headers).content.decode("utf-8", errors="ignore")
for code, name in option_prog.findall(index_text):
	dept_codes.append(code)
	dept_names[code] = name
# the first option with 5 digits is current term like 20162.
# highly fragile but simple.
for i in dept_codes:
	if len(i) == 5:
		term=i
		break
dept_codes = dept_codes[0:dept_codes.index(term)]

# traversal functions
hit=0
def get_dept(dept):
	global hit
	hit += 1
	data={"textWithoutThesis": 1, "select_dept": dept, "select_semester": term,
		"submit_CourseList": "Submit", "hidden_redir": "Login"}
	return s.post(oibs_url, headers=headers, data=data)
def get_course(ccode):
	global hit
	hit += 1
	data={"SubmitCourseInfo": "Course Info", "text_course_code": ccode,
		"hidden_redir": "Course_List"}
	return s.post(oibs_url, headers=headers, data=data)
def get_sect(sect):
	global hit
	hit += 1
	data={"submit_section": sect, "hidden_redir": "Course_Info"}
	return s.post(oibs_url, headers=headers, data=data)

# yes, we parse *all* the HTML with regular expressions.
# oibs64 templates haven't changed one byte since 2008
# there is no reason to assume they will.

# course code from dept page
ccode_prog = re.compile("<INPUT TYPE=\"radio\" VALUE=\"([0-9]*)\"")

# course name from course page
cname_prog = re.compile("Name:</B>(.*)\s\(")

# gets a section from course page. group(1) is section number. group(2) and group(3) are instructor names
sect_prog = re.compile("VALUE=\"(.*)\"  NAME=\"submit_section\"></TD>[^<]*<TD><FONT FACE=ARIAL>([^<]*)</FONT></TD>[^<]*<TD><FONT FACE=ARIAL>([^<]*)</FONT></TD>")

# gets section times of 1 course from course page. looks like oibs has a hardwired limit of 5 periods per course.
# I had this oath to extract this stuff using regular expressions, so we copy the string 5x to match all of a course's times.
# group(1) is day. group(2) is start time. group(3) is end time, group(4) is place.
# this goes all the way to group(20). some matches will be empty, just ignore them.
a = "<TR>[^<]*<TD><FONT FACE=ARIAL>([^<]*)</FONT></TD>[^<]*<TD><FONT FACE=ARIAL>([^<]*)</FONT></TD>[^<]*<TD><FONT FACE=ARIAL>([^<]*)</FONT></TD>[^<]*<TD><FONT FACE=ARIAL>([^<]*)</FONT></TD>[^<]*</TR>[^<]*"
time_prog=re.compile(a*5)
# we also need a helper function for this, 20 element tuples are not really easy things to work with.
# this directly returns the times array defined in spec, for a particular section.
days={"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
def eat_time(raw):
	out=[]
	for i in xrange(0, 20, 4):
		chunk = raw[i:i+4]
		if chunk[0] == '': continue # yes there are "period"s which have a place but no time, but know what, fuck them.
		out.append({"d": days[chunk[0]], "s": chunk[1], "e": chunk[2], "p": chunk[3]})
	return out

# gets a constraint from section page. group(1) is dept. group(2) and group(3) are starting and ending surnames.
cons_prog = re.compile("<TD><FONT FACE=ARIAL>(.*)</TD>[^<>]*<TD ALIGN=\"Center\"><FONT FACE=ARIAL>(.*)</FONT></TD>[^<>]*<TD ALIGN=\"Center\"><FONT FACE=ARIAL>(.*)</FONT></TD>", re.UNICODE)

# now the actual scraping. we traverse oibs64's dept-course-section-constraint tree one page at a time.
# blocking because I am too lazy to do this with green threads- see grequests.
# this could be much, much faster given separate sessions.
out=[]
for dept in dept_codes:
	print "hit dept %s: %s" % (dept, dept_names[dept])
	dept_text = get_dept(dept).content.decode("utf-8", errors="ignore")
	course_codes = [code for code in ccode_prog.findall(dept_text)]
	print "%d offered courses" % len(course_codes)
	for ccode in course_codes:
		cnode={}
		course_text = get_course(ccode).content.decode("utf-8", errors="ignore")
		cnode["n"] = deptify(ccode) + " - " + cname_prog.search(course_text).group(1)
		cnode["c"] = ccode
		cnode["s"] = {}
		print "hit course %s" % ccode
		print "course name: %s" % cname_prog.search(course_text).group(1)
		times = time_prog.findall(course_text)
		sects = sect_prog.findall(course_text)
		print "%d sections" % len(sects)
		for sect_match, time_match in zip(sects, times):
			snode={}
			snum = sect_match[0]
			snode["i"] = [sect_match[1], sect_match[2]]
			snode["t"] = eat_time(time_match)
			sect = sect_match[0]
			print "section %s is given by %s, %s" % (sect, sect_match[1], sect_match[2])
			print "times are", eat_time(time_match)
			sect_text = get_sect(sect).content.decode("utf-8", errors="ignore")
			cons = cons_prog.findall(sect_text)
			print "%d constraints" % len(cons)
			snode["c"] = [{"d": con[0], "s": con[1], "e": con[2]} for con in cons]
			cnode["s"][snum] = snode
		out.append(cnode)

print "done. hit %d pages" % hit

json.dump(out, open(out_file, "w"))
print "wrote %d bytes to %s" % (os.path.getsize(out_file), out_file)
