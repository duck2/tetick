# tetick course data format, an informal spec

data.json and musts.json are raw course data.

in tetick, a stripped version data.js is used, containing both course data and
"must" courses of undergraduate programs.

the course data is organized in the following way:

1. Courses are listed in a JSON array of the type
`[COURSE_DATA1, COURSE_DATA2...]`
2. COURSE_DATA is an object of the type
`{"n": COURSE_NAME, "c": COURSE_ID, "s": COURSE_SECTIONS}`
3. COURSE_SECTIONS is an array of the type
`[SECTION_DATA1, SECTION_DATA2...]`
4. SECTION_DATA is an object of the type
`{"i": SECTION_INSTRUCTORS, "c": SECTION_CONSTRAINTS, "n": SECTION_NUMBER, "t": SECTION_TIMES}`
5. SECTION_INSTRUCTORS is an array of the type
`[INSTRUCTOR1, INSTRUCTOR2]`
6. SECTION_TIMES is an array of the type
`[PERIOD1, PERIOD2...]`
7. PERIOD is an object of the type
`{"s": START_TIME, "e": "END_TIME", "d": DAY, "p": COURSE_LOCATION}`
9. SECTION_CONSTRAINTS is an array of the type
`[CONSTRAINT1, CONSTRAINT2...]`
10. CONSTRAINT is an object of the type
`{"s": SURNAME_START ,"e": SURNAME_END, "d": DEPARTMENT}`

the data for compulsory courses are organized in the following way:

1. the courses are contained in a JSON object of the type
`{DEPT1_ABBREVIATION: DEPT1_MUSTS...}`
2. DEPT_MUSTS is a JSON object of the type
`{TERM_NUMBER: COURSE_IDS}`
3. COURSE_IDS is a JSON array of the type
`[COURSE_ID1, COURSE_ID2...]` containing the full course IDs e.g. 2460154 of compulsory courses.

tetick.xyz `data.js` is valid javascript of the form
```
window.fdate=FETCH_DATE;
window.idata=INSTRUCTOR_DATA;
window.cdata=COURSE_DATA;
window.musts=MUST_COURSES;
```
INSTRUCTOR_DATA is an array containing every unique instructor name.

FETCH_DATE is a string containing the last modification time of data.json,
in the `date` format `%d %b %Y %H:%M UTC`.
e.g. "08 Feb 2017 21:39 UTC" naturally, we expect window.fdate to be stored in UTC.

while transferring from data.json and musts.json to data.js:

- instructor names are converted to their respective indices in the name array
- start and end times are converted to minutes, like "08:40" -> 520
- sections containing no time periods are removed since they cannot be included in the schedule.
- if a course has no sections left, it is also removed.
- section criteria of departments "ALL" and surnames "AA"-"ZZ" are omitted.
- course IDs of must courses are looked up in the course array and replaced with their corresponding indices.
