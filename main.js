"use strict";

/* keeps track of drawn blocks. an array of DOM elements. */
var blocks = [];

/* keeps track of added courses.
 * courses[i].handle is the DOM element.
 * courses[i].color is its assigned color.
 * courses[i].data is the course data node from window.cdata. */
var courses = [];

/* keeps track of "don't fill"s.
 * dontfills[i].d is day. dontfills[i].s is start. dontfills[i].e is end. dontfills[i].n is name. dontfills[i].c is color.
 * dontfills[i].block is the corresponding "Don't fill." block on the schedule. */
var dontfills = [], dontfill_color="#ddd";

/* program state. can have 3 values:
 * "blank": no schedule made yet.
 * "bound": there are possible schedules with current options, and are updated on change.
 * "unbound": the current schedule is not possible with current options.
 * it won't be updated until a successful make() call. */
var state = "blank";

/* keeps track of if user is idioting */
var isidiot = 0;

/* unbind if bound, redraw */
function unbind(){
	if(state == "bound") state = "unbound";
	draw();
}
/* called when program state is undefined */
function tantrum(){
	alert("I don't know what is going on");
	alert("throw an alarm on Facebook or something this is big");
}

/* top menu links and table overlays */
var els = [grab("about"), grab("wrong")];
function hideall(){
	for(var i=0; i<els.length; i++) els[i].style.display = "none";
}
function show(el){
	hideall();
	el.style.display = "block";
}
grab("about-link").onclick = function(){ show(grab("about")); };
grab("wrong-link").onclick = function(){ show(grab("wrong")); };
grab("index").onclick = grab("about").onclick = grab("wrong").onclick = hideall;

/* color palette. course colors are selected with getcolor() from this. */
var palette = ["#fcdfdf", "#fcebdf", "#dffce1", "#dffcfa", "#dff3fc", "#dfe6fc", "#e4dffc", "#f0dffc"];
/* shuffle palette, get next color. if we run out of colors, shuffle again.
 * http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array */
function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = ~~(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}
var curcolor = 0;
shuffle(palette);
function getcolor(){
	if(curcolor >= palette.length){
		shuffle(palette);
		curcolor = 0;
	}
	return palette[curcolor++];
}

/* keeps track of current possible schedules.
 * elements of schedules are arrays of time periods, which has elements like
 * {"d": day, "s": start, "e": end, "c": color, "t": text, "phantom": phantom}.
 * phantom is true if the course ignores collision checks.
 * schedules also contain the don't fills array but they are omitted in draw().
 * cursched is the schedule currently drawn on the table.
 * 0-indexed but displayed 1-indexed on the screen. */
var schedules = [];
var cursched = 0;

/* shortforms */
function grab(id){ return document.getElementById(id); }
function grabclass(cls){ return document.getElementsByClassName(cls); }
/* this is used very frequently */
function divclass(cls){
	var out = document.createElement("div");
	out.className += cls;
	return out;
}
/* button with class, text */
function button(cls, txt){
	var out = document.createElement("button");
	out.className += cls;
	out.innerHTML = txt;
	return out;
}
/* checkbox */
function cbox(cls){
	var out = document.createElement("input");
	out.type = "checkbox";
	if(cls) out.className += cls;
	return out;
}

/* tetick will keep track of schedule time in minutes.
 * we call this to translate the inner representation to something like 16:30. */
function toclock(min){
	var a = (min % 60).toString();
	if (a.length == 1) a = "0" + a;
	return Math.floor(min/60).toString() + ":" + a;
}
/* vice versa */
function tomins(clock){
	var split = clock.split(":");
	if(split.length == 1) split = split[0].split(".");
	return split[0] * 60 + parseInt(split[1]);
}

/* by default, 08:40 to 17:30 */
var start_time = 520, end_time = 1050;

/* draw a block on the table col "day"- from min1 to min2.
 * assumes min2 > min1, if not, weird results can emerge.
 * returns the dom element it makes. */
function block(day, min1, min2, color, text){
	var out = isidiot ? divclass("block idiot") : divclass("block");
	out.style.backgroundColor = color;
	var tempHeight = (100 * (min2 - min1) / (end_time - start_time));
	tempHeight = isidiot ? tempHeight - 1.5 : tempHeight;
	out.style.height = tempHeight.toString() + "%";
	out.style.top = (100 * (min1 - start_time) / (end_time - start_time)).toString() + "%";
	out.innerHTML = text + "<br>" + toclock(min1) + "-"  + toclock(min2);
	grab(day).appendChild(out);
	blocks.push(out);
	return out;
}

/* clear the schedule by deleting all drawn blocks. */
function rmblocks(){
	var i;
	for(i=0; i<blocks.length; i++) blocks[i].remove();
	blocks = [];
}

/* make an options div, return it. this is just DOM crud and clutters course() so we move it out. */
function mkopts(){
	var opts = divclass("opts"), opt = divclass("opt"), sname = cbox("sname"),
	nodept = cbox("nodept"), phantom=cbox("phantom");
	opt.appendChild(sname);
	opt.innerHTML += "check for surname";
	opts.appendChild(opt);
	opt = divclass("opt");
	opt.appendChild(nodept);
	opt.innerHTML += "no dept check";
	opts.appendChild(opt);
	opt = divclass("opt");
	opt.appendChild(phantom);
	opt.innerHTML += "phantom";
	opts.appendChild(opt);
	return opts;
}

/* make a course, append to div.courses and return it. color is from getcolor().
 * unbinds schedule. */
function course(idx){
	var outel = divclass("course"), title = divclass("title"), more = divclass("more");
	var out = {}, color = getcolor(), data = window.cdata[idx],
	close = button("close", "x");
	close.onclick = function(){ rmcourse(this.parentNode.parentNode); };
	title.innerHTML = data.n;
	title.appendChild(close);
	var ccode = isidiot ? divclass("ccode idiot") : divclass("ccode");
	ccode.innerHTML = data.c;
	title.appendChild(ccode);
	title.onclick = function(){ tgcourse(this); };
	outel.appendChild(title);
	var i, box, boxdiv, boxes = divclass("boxes"), snums = Object.keys(data.s);
	var details = "";
	for(i=0; i<snums.length; i++){
		var section_data = data.s[snums[i]];
		details += "Section " + snums[i] + ": ";
		details += section_data["i"].map(function(iindex) {
			return window.idata[iindex];
		}).join(', ') + "\n";
		details += section_data["c"].map(function(c){
			return "  " + c.d + " " + c.s + "-" + c.e;
		}).join("\n") + "\n"
		box = cbox();
		box.setAttribute("checked", true);
		boxdiv = divclass("box");
		boxdiv.appendChild(box);
		boxdiv.innerHTML += snums[i];
		boxes.appendChild(boxdiv);
	}
	var toggle = button("toggle", "toggle");
	toggle.onclick = function(){ tgboxes(this.parentNode); };
	var details_toggle = button("details_toggle", "...");
	details_toggle.onclick = function(){ tgdetails(this); };
	var details_div = divclass("details");
	details_div.innerHTML = details;
	boxes.appendChild(toggle);
	boxes.appendChild(details_toggle);
	more.appendChild(boxes);
	more.appendChild(details_div);
	more.appendChild(mkopts());
	outel.appendChild(more);
	grabclass("courses")[0].appendChild(outel);
	out.color = outel.style.backgroundColor = color;
	out.handle = outel;
	out.data = window.cdata[idx];
	courses.push(out);
	return out;
}

/* open/close a course's accordion */
function tgcourse(el){
	el.nextSibling.classList.toggle("show");
}
/* toggle a course's boxes. used in toggle button. el is div.more. */
function tgboxes(el){
	var i, boxes = el.querySelectorAll("input[type=checkbox]");
	for(i=0; i<boxes.length; i++) boxes[i].checked = !boxes[i].checked;
}
/* toggle details */
function tgdetails(el){
	var details = el.parentNode.nextSibling;
	if(details.style.display == "block")
		details.style.display = "none";
	else
		details.style.display = "block";
}

/* get a course in courses from its handle.
 * yes, searching in non-sorted array is slow but courses should be 10 items at most.
 * ES6 has map() which permits tying Objects together. take a look if this becomes trouble. */
function getcourse(el){
	var i;
	for(i=0; i<courses.length; i++) if(courses[i].handle === el) return courses[i];
}
/* remove a course from its handle.
 * the main use of this is X buttons on course titles. unbinds schedule. */
function rmcourse(el){
	courses.splice(courses.indexOf(getcourse(el)), 1);
	el.remove();
}

/* does this new don't fill conflict with any in the array? */
function df_conflicts(df){
	var i;
	if(df.s < start_time || df.e < df.s) return true;
	for(i=0; i<dontfills.length; i++){
		if(df.d != dontfills[i].d) continue;
		if(df.s < dontfills[i].e && dontfills[i].s < df.e) return true;
	}
	return false;
}
/* create a don't fill named n, on day d, from s to e.
 * the resulting node won't have any corresponding block until draw() is called.
 * can "unbind" the state if the resulting don't fill leaves no possible schedules.
 * TODO: checks for this so it does not set outside [start_time, end_time] */
function dontfill(d, s, e, n){
	var color;
	(n === "Don't fill") ? (color = dontfill_color) : (color = getcolor());
	for (var i=0;i<dontfills.length;i++){
		if (dontfills[i].c && dontfills[i].n === n) color = dontfills[i].c;
	}
	var out = {"n": n, "d": d, "s": s, "e": e, "c":color, "block": {}};
	if(df_conflicts(out)) return;
	dontfills.push(out);
	switch(state){
	case "blank":
	case "unbound":
		break;
	case "bound":
		if(!compute()){
			dontfills.splice(dontfills.indexOf(out), 1);
			unbind();
		}
		break;
	default: tantrum();
	}
	draw();
}
/* remove a don't fill block by its corresponding DOM element.
 * triggers a compute() in bound mode. assumes there will be possible schedules. */
function rmdontfill(event, el){
	var i;
	for(i=0; i<dontfills.length; i++) if(dontfills[i].block === el){
		dontfills.splice(i, 1);
		el.remove();
	}
	if(state === "bound") compute();
	draw();
	event.stopPropagation();
}
/* handle a click on a td. we fake table cell behavior on that, rounding to nearest ..40:..30 block. */
function eatdclick(event, el){
	var rect = el.getBoundingClientRect(), y = event.clientY - rect.top,
	mins = Math.round(start_time + (end_time - start_time) * (y) / rect.height),
	start = start_time + Math.floor((mins - start_time) / 60) * 60;
	dontfill(el.id, start, start+50, "Don't fill");
}
var eatds = grabclass("eatd");
for(i=0; i<eatds.length; i++) eatds[i].onclick = function(ev){ eatdclick(ev, this); };

/* we also accept don't fills from the form. */
function df_form(){
	var d = parseInt(grab("d").value);
	if(isNaN(d) || d < 1 || d > 5)
		return;
	var s = tomins(grab("s").value);
	var e = tomins(grab("e").value);
	if(isNaN(s) || isNaN(e))
		return;
	var n = grab("n").value || "Don't fill.";
	dontfill(d-1, s, e, n);
}
grab("dontfill").onclick = df_form;

/* is this section fine with these values? deptcheck and sncheck are self explanatory. returns true if yes. */
function ck_sect(sect, deptcheck, sncheck){
	var i, dept=grab("dept").value.toUpperCase(), sname=grab("surname").value.toUpperCase(),
	deptck = function(c){
		if(!dept || !deptcheck) return true;
		if(c.d === "ALL" || c.d === dept) return true;
		return false;
	}, snck = function(c){
		if(!sname || !sncheck) return true;
		var cmp = function(x){ return sname.localeCompare(x, "tr"); };
		if(cmp(c.s) >= 0 && cmp(c.e) <= 0) return true;
		return false;
	};
	if(sect.c.length === 0) return true;
	for(i=0; i<sect.c.length; i++) if(deptck(sect.c[i]) && snck(sect.c[i])) return true;
	return false;
}
/* get all possible sections for currently added courses.
 * also put the section number in them as snode.n- we will need it later.
 * returns an array of arrays, mapped to the courses array in practice.
 * each array has the suitable section nodes in it. */
function get_sects(){
	var i, j, n, node, boxes, deptcheck, sncheck, out = [];
	for(i=0; i<courses.length; i++){
		node = [];
		boxes = courses[i].handle.getElementsByClassName("boxes")[0].querySelectorAll("input[type=checkbox]:checked");
		deptcheck = !grab("nodeptcheck").checked && !courses[i].handle.getElementsByClassName("nodept")[0].checked;
		sncheck = grab("sncheck").checked || courses[i].handle.getElementsByClassName("sname")[0].checked;
		for(j=0; j<boxes.length; j++){
			n = boxes[j].nextSibling.data;
			if(!ck_sect(courses[i].data.s[n], deptcheck, sncheck)) continue;
			courses[i].data.s[n].n = n;
			node.push(courses[i].data.s[n]);
		}
		out.push(node);
	}
	return out;
}
/* another prelude of compute(). extracts sections' time periods.
 * puts colors and text into them, so we don't have to repeatedly touch courses[i] while drawing.
 * this clutters course data. however we do this on every compute(), nothing should go wrong.
 *
 * digest() also checks which courses are phantom and assigns "phantom": true to their time periods.
 * arrays of phantom courses are pushed to the end since there is no imaginary mapping between
 * courses and sections now. this way compute() can collision check until it sees a time period array
 * with phantom: true, then insert the rest arbitrarily. */
function hasphantom(sect){
	if(!sect || !sect[0] || !sect[0][0]) return false;
	return sect[0][0].phantom;
}
function digest(sects){
	var i, j, k, node, out = [];
	for(i=0; i<sects.length; i++){
		node = [];
		var color = courses[i].color, name = courses[i].data.n.split(" -")[0],
		phantom = grab("allphantom").checked || courses[i].handle.getElementsByClassName("phantom")[0].checked;
		for(j=0; j<sects[i].length; j++){
			for(k=0; k<sects[i][j].t.length; k++) {
				sects[i][j].t[k].t = name + "(" + sects[i][j].n + ") " + sects[i][j].t[k].p;
				sects[i][j].t[k].c = color;
				sects[i][j].t[k].phantom = phantom;
			}
			node.push(sects[i][j].t);
		}
		out.push(node);
	}
	out.sort(function(a, b){ if(!hasphantom(a) && hasphantom(b)) return -1; return 1; });
	return out;
}
/* see if this schedule is viable */
function viable(sch){
	var i;
	for(i=1; i<sch.length; i++) if(sch[i].d == sch[i-1].d && (sch[i].s < sch[i-1].e || sch[i].s == sch[i-1].s)) return false;
	return true;
}
/* tuck an array of time periods into our array of sorted time periods, return new array.
 * yes, this function is very specific and yes it clutters the Array prototype. (native tuck_multiple? :D)
 * however you can think of this as another part of the data monorail to compute().
 * tuck is simple binary search, finds an index to insert the new time period and then tucks it there. */
Array.prototype.tuck_multiple = function(times){
	var i, out = this.slice(),
	tuck = function(sch, time){
		var lo = 0, hi = sch.length, i;
		while(lo<hi){
			i = hi+lo >>> 1;
			if(time.d < sch[i].d || (time.d == sch[i].d && time.s < sch[i].s)) hi = i;
			else lo = i+1;
		}
		sch.splice(lo, 0, time);
	};
	for(i=0; i<times.length; i++) tuck(out, times[i]);
	return out;
};
/* sort the schedule wrt day and start time */
function sortsch(sch){
	sch.sort(function(a, b){if(b.d < a.d || (b.d == a.d && b.s < a.s)) return 1; return -1;});
	return sch;
}
/* compute possible schedules. returns true if all went fine, false if no possible schedules.
 * since this will be exponential with course count anyway, we do some kind of branch elimination.
 * instead of getting all permutations and checking them if they are viable, we branch course by course.
 * we do this by maintaining sorted arrays of time periods. this is because it makes checking overlaps
 * as easy as checking if any period's start time is before the end time of the previous period. */
function compute(){
	var i, j, k, out = [sortsch(dontfills)], out_nxt, sects = digest(get_sects());
	for(i=0; i<sects.length; i++){
		out_nxt = [];
		if(hasphantom(sects[i])) break;
		for(j=0; j<out.length; j++){
			for(k=0; k<sects[i].length; k++){
				var part = out[j].tuck_multiple(sects[i][k]);
				if(viable(part)) out_nxt.push(part);
			}
		}
		out = out_nxt.slice();
	}
	for(;i<sects.length; i++){ /* now the phantom courses. */
		out_nxt = [];
		for(j=0; j<out.length; j++) for(k=0; k<sects[i].length; k++) out_nxt.push(out[j].concat(sects[i][k]));
		out = out_nxt.slice();
	}
	if(out.length === 0 || out[0].length === 0) return false;
	schedules = out;
	return true;
}

/* draw the current state on the schedule.
 * first we get the latest hour on the schedule and adjust end_time. it defaults to 1050.
 * this can be easily extended to have adjustable start_time too, it is just that I have never seen a course before 8:40.
 * then we draw don't fills, then if state is not blank, we draw courses. there are don't fills in
 * schedules, we ignore them while drawing. */
function draw(){
	var i;
	grab("nextb").style.display = grab("prevb").style.display = "none"; /* a table reset */
	flashlighton = 0;
	hideall();
	rmblocks();
	end_time = 1050;
	for(i=0; i<dontfills.length; i++) if(dontfills[i].e > end_time) end_time = dontfills[i].e;
	if(cursched >= schedules.length) cursched = 0;
	var sch = schedules[cursched];
	if(sch && sch.length) for(i=0; i<sch.length; i++) if(sch[i].e > end_time) end_time = sch[i].e;
	for(i=0; i<dontfills.length; i++){
		if (!dontfills[i].c)
			dontfills[i].block = block(dontfills[i].d, dontfills[i].s, dontfills[i].e, dontfill_color, dontfills[i].n);
		else
			dontfills[i].block = block(dontfills[i].d, dontfills[i].s, dontfills[i].e, dontfills[i].c, dontfills[i].n);
		dontfills[i].block.style.zIndex = 2;
		dontfills[i].block.onclick = function(ev){ rmdontfill(ev, this); };
	}
	if(sch && sch.length) {
		for(i=0; i<sch.length; i++){
			if(!sch[i].t) continue;
			var a = block(sch[i].d, sch[i].s, sch[i].e, sch[i].c, sch[i].t);
			if(sch[i].phantom) a.style.opacity = 0.6;
		}
		grab("counter").innerHTML = (cursched+1).toString() + "/" + schedules.length;
	}
	grab("start_time").innerHTML = toclock(start_time);
	grab("end_time").innerHTML = toclock(end_time);
	switch(state){
	case "blank":
		grab("state").innerHTML = "blank";
		grab("state").style.color = "black";
		return;
	case "unbound":
		grab("state").innerHTML = "unbound- make to bind.";
		grab("state").style.color = "coral";
		return;
	case "bound":
		grab("state").innerHTML = "bound";
		grab("state").style.color = "royalblue";
		return;
	default: tantrum();
	}
}

/* make schedules, find state */
function make(){
	if(compute()) state = "bound";
	else alert("no schedules.");
	draw();
}
grab("make").onclick = make;

/* navigate schedules. arrow keys also work. */
function prev(){
	if(state == "blank") return;
	if(--cursched < 0) cursched = schedules.length-1;
	draw();
}
function next(){
	if(state == "blank") return;
	if(++cursched >= schedules.length) cursched = 0;
	draw();
}
grab("prev").onclick = prev;
grab("next").onclick = next;
document.onkeydown = function(ev){
	if(ev.keyCode == "37") prev();
	if(ev.keyCode == "39") next();
};

/* we make the awesomplete list, together with course lookup table.
 * the lookup binds course names to window.cdata indices so we can utilize
 * javascript's hashtable to look for a named course. */
var i, j = [], lookup = {};
for(i=0; i<window.cdata.length; i++){
	j.push(window.cdata[i].n);
	lookup[window.cdata[i].n] = i;
}
new Awesomplete(grab("course-list"), {list: j});

grab("add-musts").onclick = function(){
	var i, musts = window.musts[grab("dept").value.toUpperCase()][grab("semester").value];
	for(i=0; i<musts.length; i++) course(musts[i]);
	if(courses[0]) courses[0].handle.children[0].click(); /* click its title */
}

grab("add").onclick = function(){
	course(lookup[grab("course-list").value]);
};

/* remaining bound with those is hard */
grab("sncheck").onchange = grab("surname").onchange = grab("nodeptcheck").onchange = grab("allphantom").onchange = unbind;

/* the save link encodes the state in window.location.hash, the URL effectively.
 * if we find a non-empty window.location.hash, we attempt to restore a state from it.
 * the state is stored like
 * {d: dontfills, n: current schedule, c: courses, dp: dept, t: term, sc, dc, ap: surname, dept, all phantom?, sn: surname, i: is idiot}
 * the courses are stored like
 * {n: name, s: not checked sections, u, d, p: surname check, dept check, phantom checkboxes.}
 * TODO: pls make a shorthand for hnd.getElementsByClassName it is too long TOO MANy keystrokes */
function getstate(){
	var i, j, out = {};
	out.d = dontfills;
	out.n = cursched;
	out.c = [];
	for(i=0; i<courses.length; i++){
		var boxes, node = {}, hnd = courses[i].handle;
		node.n = courses[i].data.n;
		node.s = [];
		boxes = hnd.getElementsByClassName("boxes")[0].querySelectorAll("input[type=checkbox]:not(:checked)");
		for(j=0; j<boxes.length; j++){
			node.s.push(boxes[j].nextSibling.data);
		}
		node.u = hnd.getElementsByClassName("sname")[0].checked ? 1 : 0;
		node.d = hnd.getElementsByClassName("nodept")[0].checked ? 1 : 0;
		node.p = hnd.getElementsByClassName("phantom")[0].checked ? 1 : 0;
		out.c.push(node);
	}
	out.dp = grab("dept").value;
	out.t = grab("semester").value;
	out.sn = grab("surname").value;
	out.sc = grab("sncheck").checked ? 1 : 0;
	out.dc = grab("nodeptcheck").checked ? 1 : 0;
	out.ap = grab("allphantom").checked ? 1 : 0;
	out.i = isidiot;
	return out;
}
var saved = false;
function save(){
	window.localStorage.setItem('state', JSON.stringify(getstate()));
	alert("your settings are saved in your browser.");
	saved = true;
}
/* this does not errorcheck because there is no point providing feedback if someone put garbage in localStorage. */
function restorestate(st){
	var i, j;
	isidiot = st.i;
	if(isidiot)	{
		idiot(true);
	}
	dontfills = st.d;
	dontfillColorize();
	for(i=0; i<st.c.length; i++){
		var c = course(lookup[st.c[i].n]),
			boxes = c.handle.getElementsByClassName("boxes")[0].querySelectorAll("input[type=checkbox]");
		for(j=0; j<boxes.length; j++){
			if(st.c[i].s.indexOf(boxes[j].nextSibling.data) > -1) boxes[j].checked = false;
		}
		c.handle.getElementsByClassName("sname")[0].checked = st.c[i].u ? true : false;
		c.handle.getElementsByClassName("nodept")[0].checked = st.c[i].d ? true : false;
		c.handle.getElementsByClassName("phantom")[0].checked = st.c[i].p ? true : false;
	}
	grab("dept").value = st.dp;
	grab("semester").value = st.t;
	grab("surname").value = st.sn;
	grab("sncheck").checked = st.sc ? true : false;
	grab("nodeptcheck").checked = st.dc ? true : false;
	grab("allphantom").checked = st.ap ? true : false;

	if(courses.length > 0) make();
	cursched = st.n;
}

function load(){
	var h = window.localStorage.getItem('state');
	if(h) restorestate(JSON.parse(h));
}
function load_legacy(){
	var h = window.location.hash.replace(/^#/, "");
	if(h) restorestate(JSON.parse(atob(h)));
}

grab("save").onclick = save;

/* main() :D */
grab("fdate").innerHTML += window.fdate;
if(window.localStorage.getItem('state')) load();
else if(window.location.hash) load_legacy();
draw();

/* current opaque */
var curopq;
var flashlighton = 0;
/* enable the user to iterate through drawn blocks one block a time, so they can see overlapping courses
 * when there are phantom courses this results in non-intuitive iteration, so we sort the schedule.
 * both toggles trigger a draw(). */
function flashlight(){
	if(!blocks.length) return;
	if(flashlighton){
		grab("prevb").style.display = grab("nextb").style.display = "none";
		draw();
		return;
	}
	sortsch(schedules[cursched]); draw();
	grab("prevb").style.display = grab("nextb").style.display = "initial";
	for (var i=0; i<blocks.length; i++) blocks[i].style.opacity = 0.1;
	curopq=0;
	blocks[0].style.opacity = 0.9;
	flashlighton=1;
}
function nextb(){
	blocks[curopq++].style.opacity = 0.1;
	if(curopq>=blocks.length) curopq = 0;
	blocks[curopq].style.opacity = 0.9;
}
function prevb(){
	blocks[curopq--].style.opacity = 0.1;
	if(curopq<0) curopq = blocks.length-1;
	blocks[curopq].style.opacity = 0.9;
}
grab("fl").onclick = flashlight;
grab("prevb").onclick = prevb;
grab("nextb").onclick = nextb;

/* removes all courses from the courses list. */
function rmcourses(){
	grabclass("courses")[0].innerHTML = '<div style="text-align: center; margin: 0.8em;"> current courses </div>';
	courses = [];
}

function idiot(isLoad){
	isLoad = typeof isLoad !== 'undefined' ? isLoad : false;
	var tempstate = getstate();
	if(tempstate !== {}) {
		tempstate.i = 1;
	}
	if(!isLoad) {
		rmcourses();
		rmblocks();
		courses = [];
	}
	dontfill_color = "#000";
	palette = ["#CC0000", "#7A00CC", "#29A329", "#CCCC00",  "#00CCCC", "#00008A", "#002900", "#E62EB8", "#005C5C", "#CC3300", "#808080", "#00FF00", "#666633", "#002E2E"];
	var all = document.querySelectorAll("*");
	for(i=0; i<all.length; i++) {
		all[i].classList.add("idiot");
	}
	isidiot = 1;
	document.getElementById('idiot-link').innerHTML = 'take me back!';
	if(!isLoad) {
		restorestate(tempstate);
	}
}

function clever(){
	var tempstate = getstate();
	if(tempstate !== {}) {
		tempstate.i = 0;
	}
	rmcourses();
	rmblocks();
	courses = [];
	palette = ["#fcdfdf", "#fcebdf", "#dffce1", "#dffcfa", "#dff3fc", "#dfe6fc", "#e4dffc", "#f0dffc"];
	dontfill_color = "#ddd";
	var all = document.querySelectorAll("*");
	for(i=0; i<all.length; i++) {
		all[i].classList.remove("idiot");
	}
	isidiot = 0;
	document.getElementById('idiot-link').innerHTML = 'ugly!';
	restorestate(tempstate);
}

grab("idiot-link").onclick = function(){ if(isidiot === 1) { clever();} else { idiot();} };

function dontfillColorize() {
	for (var i = 0; i < dontfills.length; i++) {
		var color;
		(dontfills[i].n === "Don't fill") ? (color = dontfill_color) : (color = getcolor());
		dontfills[i].c = color;
	}
}