# tetick course data format, an informal spec

data.json and musts.json are raw course data, used in tetick explorer.

in the main app, a stripped version data.js is used, containing both course data and
"must" courses of undergraduate programs.

the course data is organized in the following way:

1. Courses are listed in a JSON array of the type
`[COURSE_DATA1, COURSE_DATA2...]`
2. COURSE_DATA is an object of the type
`{"n": COURSE_NAME, "c": COURSE_ID, "s": COURSE_SECTIONS}`
3. COURSE_SECTIONS is an object of the type
`{SECTION_NUMBER1: SECTION_DATA1, SECTION_NUMBER2: SECTION_DATA2...}`
4. SECTION_DATA is an object of the type
`{"i": SECTION_INSTRUCTORS, "c": SECTION_CONSTRAINTS, "t": SECTION_TIMES}`
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

these are for tetick explorer. data is modified for tetick.xyz usage.

tetick.xyz `data.js` is valid javascript of the form
```
window.cdata=COURSE_DATA;
window.musts=MUST_COURSES;
```

while transferring from data.json and musts.json to data.js:

- instructor names are stripped from course data.
- start and end times are converted to minutes, like "08:40" -> 520
- sections containing no time periods are removed since they cannot be included in the schedule anyway.
- if a course has no sections left, it is also removed.
- course IDs of must courses are looked up in the course array and replaced with their corresponding indices.
