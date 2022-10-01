# coding: utf-8
import os, re
import json
import requests

import codecs, sys


# this scrapes oibs64 for all the course data.
# see data_spec.md for interpreting out_file.
# be aware- spits a lot of output to stdout.

out_file="data.json"

oibs_url="https://oibs2.metu.edu.tr/View_Program_Course_Details_64/main.php"

# stuff for department-izing course codes.
# a course ID like 5720172 does not become aee172 on its own.
prefixes = {'219': 'GENE', '956': 'OCEA', '450': 'FLE', '612': 'PERS', '451': 'TEFL', '810': 'GWS', '811': 'UPL', '814': 'SA', '815': 'ARS', '816': 'MCS', '817': 'FPSY', '453': 'PES', '120': 'ARCH', '121': 'CRP', '125': 'ID', '420': 'SSME', '363': 'STAS', '379': 'ARC', '378': 'GPC', '410': 'ELE', '411': 'ECE', '371': 'PSYC', '370': 'FRN', '372': 'SOCL', '821': 'ELIT', '820': 'ELT', '377': 'PHL', '822': 'ESME', '312': 'BA', '311': 'ECON', '310': 'ADM', '316': 'BAS', '315': 'GIA', '314': 'IR', '391': 'ENLT', '390': 'SEES', '832': 'MES', '833': 'EUS', '795': 'TKPR', '831': 'STPS', '837': 'EMBA', '834': 'HRDE', '835': 'EAS', '838': 'EI', '839': 'SPL', '798': 'ENEL', '368': 'EDUS', '369': 'GRM', '366': 'EFL', '367': 'CHME', '364': 'CVE', '365': 'MECH', '362': 'HST', '910': 'CSEC', '360': 'CHM', '361': 'TUR', '855': 'UD', '246': 'STAT', '384': 'ASE', '240': 'HIST', '386': 'IDS', '902': 'COGS', '901': 'IS', '843': 'LNA', '842': 'ASN', '841': 'GTSS', '840': 'SAN', '375': 'ART', '908': 'BIN', '909': 'GATE', '374': 'PNGE', '643': 'THEA', '642': 'TURK', '644': 'SLTP', '241': 'PHIL', '376': 'CTE', '430': 'CEIT', '385': 'SPN', '573': 'FDE', '572': 'AEE', '571': 'CENG', '570': 'METE', '454': 'EDS', '880': 'OR', '629': 'TFL', '854': 'BS', '853': 'CP', '856': 'CONS', '857': 'IDDI', '852': 'RP', '970': 'IAM', '858': 'ARCD', '651': 'MUS', '568': 'IE', '569': 'ME', '560': 'ENVE', '561': 'ES', '562': 'CE', '563': 'CHE', '564': 'GEOE', '565': 'MINE', '566': 'PETE', '567': 'EE', '906': 'MI', '904': 'ION', '861': 'BTEC', '860': 'BCH', '863': 'ARME', '862': 'PST', '865': 'GGIT', '864': 'ASTR', '867': 'SE', '866': 'EM', '905': 'SM', '605': 'JA', '604': 'GERM', '607': 'RUS', '606': 'ITAL', '603': 'FREN', '608': 'SPAN', '238': 'BIOL', '234': 'CHEM', '236': 'MATH', '230': 'PHYS', '232': 'SOC', '233': 'PSY', '878': 'NSNT', '876': 'MDM', '950': 'MASC', '874': 'ESS', '872': 'BME', '873': 'EQS', '870': 'CEME', '871': 'MNT', '354': 'PSIR', '639': 'ENG', '610': 'GRE', '611': 'CHN', '357': 'MAT', '356': 'EEE', '355': 'CNG', '954': 'MBIO', '353': 'BUS', '352': 'ECO', '877': 'OHS', '801': 'AH', '358': 'PHY', '359': 'ENGL', '682': 'INST', "976": "IAM", "836": "PHIL", "459": "BED", "373": "BIO", "351": "BUSD", "952": "MASC", "422": "CHED", "971": "IAM", "825": "EDS", "875": "EQS", "824": "EDS", "797": "EEE", "401": "ECE", "413": "EME", "412": "ESE", "799": "ENOT", "383": "ESC", "382": "ENV", "884": "ENVM", "973": "FM", "800": "SBE", "869": "HE", "791": "AUTO", "602": "ARAB", "951": "MASC", "421": "PHED", "972": "SC", "907": "WBLS"}

def deptify(ccode):
	a, b = ccode[:3], ccode[3:]
	if b[0] == "0": b = b[1:]
	try:
		return prefixes[a] + b
	except:
		print("WARN! I don't know what department is %s" % a)
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

# decode with errors=ignore because oibs put a comment encoded in iso-8859-9 in the page
# which unsurprisingly makes the utf8 codec throw an error.
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
	return s.post(oibs_url, headers=headers, data=data).content.decode("utf-8", errors="ignore")
def get_course(ccode):
	global hit
	hit += 1
	data={"SubmitCourseInfo": "Course Info", "text_course_code": ccode,
		"hidden_redir": "Course_List"}
	return s.post(oibs_url, headers=headers, data=data).content.decode("utf-8", errors="ignore")
def get_sect(sect):
	global hit
	hit += 1
	data={"submit_section": sect, "hidden_redir": "Course_Info"}
	return s.post(oibs_url, headers=headers, data=data).content.decode("utf-8", errors="ignore")

# yes, we parse *all* the HTML with regular expressions.
# oibs64 templates haven't changed one byte since 2008
# there is no reason to assume they will.

# course code from dept page
ccode_prog = re.compile("<INPUT TYPE=\"radio\" VALUE=\"([0-9]*)\"")

# course name from course page
cname_prog = re.compile("Course Name: </B>(.*)\s\(")

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
	for i in range(0, 20, 4):
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
	print("hit dept %s: %s" % (dept, dept_names[dept]))
	dept_text = get_dept(dept)
	course_codes = [code for code in ccode_prog.findall(dept_text)]
	print("%d offered courses" % len(course_codes))
	for ccode in course_codes:
		cnode={}
		course_text = get_course(ccode)
		cnode["n"] = deptify(ccode) + " - " + cname_prog.search(course_text).group(1)
		cnode["c"] = ccode
		cnode["s"] = {}
		print("hit course %s" % ccode)
		print("course name: %s" % cname_prog.search(course_text).group(1))
		times = time_prog.findall(course_text)
		sects = sect_prog.findall(course_text)
		print("%d sections" % len(sects))
		for sect_match, time_match in zip(sects, times):
			snode={}
			snum = sect_match[0]
			snode["i"] = [sect_match[1], sect_match[2]]
			snode["t"] = eat_time(time_match)
			sect = sect_match[0]
			print("section %s is given by %s, %s" % (sect, sect_match[1], sect_match[2]))
			print("times are", eat_time(time_match))
			sect_text = get_sect(sect)
			cons = cons_prog.findall(sect_text)
			print("%d constraints" % len(cons))
			snode["c"] = [{"d": con[0], "s": con[1], "e": con[2]} for con in cons]
			cnode["s"][snum] = snode
		out.append(cnode)

print("done. hit %d pages" % hit)

json.dump(out, open(out_file, "w"))
print("wrote %d bytes to %s" % (os.path.getsize(out_file), out_file))
