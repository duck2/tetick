"use strict";

/***
 * 0. helpers
 ***/

window.$ = document.querySelector.bind(document);
window.$$ = document.querySelectorAll.bind(document);
Element.prototype.$ = Element.prototype.querySelector;
Element.prototype.$$ = Element.prototype.querySelectorAll;
Element.prototype.Ac = Element.prototype.appendChild;
NodeList.prototype.forEach = Array.prototype.forEach;
NodeList.prototype.some = Array.prototype.some;

/***
 * 1. gpu dithering
 ***/

let canvas = $("#dither-webgl");
let gl = canvas.getContext("webgl");
let canvas_tmp = $("#dither-tmp");
let ctx_tmp = canvas_tmp.getContext("2d");
let W = 64;
let H = 64;
let img_data = ctx_tmp.createImageData(W, H);
let fb = img_data.data;

let vs = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vs, `
	attribute vec2 a_p;
	attribute vec2 a_uv;
	varying vec2 v_uv;
	void main(){
		gl_Position = vec4(a_p,0,1);
		v_uv = a_uv;
	}
`);
gl.compileShader(vs);
if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)){
	throw "could not compile shader:" + gl.getShaderInfoLog(vs);
}

let fs = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fs, `
	precision mediump float;
	uniform vec4 u_P[3];
	uniform float u_L;
	uniform vec2 u_d;
	uniform sampler2D u_By;
	uniform sampler2D u_Blu;
	uniform int u_m;

	varying vec2 v_uv;

	void main(){
		vec4 c0;
		float d, d0 = 1e14;
		vec4 x = u_m == 0 ?
			(texture2D(u_By, v_uv*4.0+u_d) - 0.5) * 0.25 :
			(texture2D(u_Blu, v_uv+u_d) - 0.5) * 0.25;
		for(int i=0; i<3; i++){
			d =length(u_P[i] - u_L + x);
			if(d < d0){
				d0 = d;
				c0 = u_P[i];
			}
		}
		gl_FragColor = c0;
	}
`);
gl.compileShader(fs);
if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)){
	throw "could not compile shader:" + gl.getShaderInfoLog(fs);
}

let prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
	throw "could not link shader:" + gl.ProgramInfoLog(prog);
}

gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.useProgram(prog);

let quad = new Float32Array([1,1,-1,1,-1,-1,-1,-1,1,-1,1,1]);
let tex_quad = new Float32Array([W/64,0,0,0,0,H/64,0,H/64,W/64,H/64,W/64,0]);
let p_buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, p_buf);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

let Ts = ["bayer16", "blueness"].map(id => {
	let t = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, t);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	let I = document.getElementById(id);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, I);
	return t;
});

function dither(color, method){
	gl.bindBuffer(gl.ARRAY_BUFFER, p_buf);
	let a_p = gl.getAttribLocation(prog, "a_p");
	gl.enableVertexAttribArray(a_p);
	gl.vertexAttribPointer(a_p, 2, gl.FLOAT, false, 0, 0);

	let a_uv = gl.getAttribLocation(prog, "a_uv");
	let uv_buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uv_buf);
	gl.bufferData(gl.ARRAY_BUFFER, tex_quad, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(a_uv);
	gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 0, 0);

	gl.uniform1i(gl.getUniformLocation(prog, "u_By"), 0);
	gl.uniform1i(gl.getUniformLocation(prog, "u_Blu"), 1);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, Ts[0]);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, Ts[1]);

	let P = [...color.c0,255,...color.c1,255,253,243,215,255];
	let u_P = gl.getUniformLocation(prog, "u_P");
	gl.uniform4fv(u_P, P.map(x => x/255));
	let u_L = gl.getUniformLocation(prog, "u_L");
	gl.uniform1f(u_L, color.L/255);
	let u_d = gl.getUniformLocation(prog, "u_d");
	gl.uniform2f(u_d, Math.random(), Math.random());

	if(method == "blue")
		gl.uniform1i(gl.getUniformLocation(prog, "u_m"), 1);
	else if(method == "bayer")
		gl.uniform1i(gl.getUniformLocation(prog, "u_m"), 0);
	else
		console.error(method);

	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

/* color looks like {c0, c1, L} */
function dither_element(el, color){
	dither(color, "bayer");
	ctx_tmp.drawImage(canvas, 0, 0);
	let url = canvas_tmp.toDataURL();
	el.style.backgroundImage = "url('" + url + "')";
}


/***
 * 2. global vars, utility functions
 ***/

/* keeps track of drawn blocks. an array of DOM elements. */
let blocks = [];

/* keeps track of added courses.
 * courses[i].handle is the DOM element.
 * courses[i].data is the course data node from window.cdata.
 * courses[i].legal_sects is cache for last computed legal sections. */
let courses = [];

/* keeps track of "don't fill"s.
 * dontfills[i].d is day. dontfills[i].s is start. dontfills[i].e is end. dontfills[i].n is name. dontfills[i].c is color.
 * dontfills[i].block is the corresponding "Don't fill." block on the schedule. */
let dontfills = [], dontfill_color="#ddd";

/* program state. can have 3 values:
 * "blank": no schedule made yet.
 * "bound": there are possible schedules with current options, and are updated on change.
 * "unbound": the current schedule is not possible with current options.
 * it won't be updated until a successful make() call. */
let state = "blank";

/* unbind if bound, redraw */
function unbind(){
	if(state == "bound") state = "unbound";
	draw();
}
/* called when program state is undefined */
function tantrum(){
	alert("uhh I'm broken");
}

/* color palette. course bgs are selected with getcolor() from this.
 * a "bg" needs two colors and a luminance value to determine
 * the tone to get with dithering */
let palette = [
	{c0: [196,213,217], c1:[96,176,183], Ls:[156,170,180,190,200,213,220,230,240], i_L: 0},
	{c0: [184,217,206], c1:[88,184,139], Ls:[155,172,181,195,205,213,220,229,240], i_L: 0},
	{c0: [217,180,180], c1:[184,116,127], Ls:[172,181,195,205,213,220,229,240], i_L: 0},
	{c0: [195,200,217], c1:[116,141,184], Ls:[172,189,205,217,220,228,238], i_L: 0},
	{c0: [215,204,217], c1:[175,154,184], Ls:[163,181,195,215,224,232,240], i_L: 0},
];

/* default dontfill background */
let df_bg = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEXMzMz989dJCSbuAAAAG0lEQVQIHWNkZGBcxcDIACYF/yPYyOICjHBxAKEpBoTMsaIUAAAAAElFTkSuQmCC')";

/* get color from course code.
 * by default we try to assign the same "chroma" to courses
 * from the same dept. keep map of dept code -> palette index for that.
 * if all chromas are full, the next "luma" will be selected for the next course */
let dtop = {};
let colors = {};
let i_palette = 0;
function getcolor(code){
	if(colors[code])
		return colors[code];
	let dept = code.substr(0,3);
	let rest = code.substr(3);
	let i_C = dtop[dept] = dtop[dept] !== undefined ? dtop[dept] : i_palette++;
	let C = palette[i_C % palette.length];
	let out = {c0: C.c0, c1: C.c1, L: C.Ls[C.i_L++ % C.Ls.length]};
	colors[code] = out;
	return out;
}

/* keeps track of current possible schedules.
 * elements of schedules are arrays of time periods, which has elements like
 * {"d": day, "s": start, "e": end, "c": color, "t": text, "phantom": phantom}.
 * phantom is true if the course ignores collision checks.
 * schedules also contain the don't fills array but they are omitted in draw().
 * cursched is the schedule currently drawn on the table.
 * 0-indexed but displayed 1-indexed on the screen. */
let schedules = [];
let cursched = 0;

/* this is used very frequently */
function divclass(cls){
	let out = document.createElement("div");
	out.className += cls;
	return out;
}

/* button with class, text */
function button(cls, txt){
	let out = document.createElement("button");
	out.className += cls;
	out.innerHTML = txt;
	return out;
}

/* checkbox */
function cbox(cls){
	let out = document.createElement("input");
	out.type = "checkbox";
	if(cls) out.className += cls;
	return out;
}

/* get uuid with hacky method */
function uuid(n){
	return Math.random().toString(36).substr(2, n);
}

/* tetick will keep track of schedule time in minutes.
 * we call this to translate the inner representation to something like 16:30. */
function toclock(min){
	let a = (min % 60).toString();
	if (a.length == 1) a = "0" + a;
	return Math.floor(min/60).toString() + ":" + a;
}

/* vice versa */
function tomins(clock){
	let split = clock.split(":");
	if(split.length == 1) split = split[0].split(".");
	return split[0] * 60 + parseInt(split[1]);
}

/* by default, 08:40 to 17:40 */
let start_time = 520, end_time = 1060;
let days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
let schedule_height = 360;


/***
 * 3. dom management
 ***/

/* draw a block on d from s to e.
 * assumes s > e.
 * returns the dom element it makes. */
function block(d, s, e, bg, text){
	let out = divclass("block");
	let H = schedule_height;
	let W = $("#tt").offsetWidth;
	e += 10;

	out.style.height = H * (e - s) / (end_time - start_time) + "px";
	out.style.left = d * 20 + "%";
	out.style.top = Math.round(H * (s - start_time) / (end_time - start_time)) + "px";

	let out2 = divclass("bb");
	out2.style.backgroundImage = bg;
	out2.innerHTML = text;

	out.Ac(out2);
	$("#tt").Ac(out);
	blocks.push(out);
	return out;
}

/* clear the schedule by deleting all drawn blocks. */
function rmblocks(){
	let i;
	for(i=0; i<blocks.length; i++) blocks[i].remove();
	blocks = [];
}

/* make a course element and associated object
 * append the element to #div.courses
 * append the object to `courses`
 * and return the object, which looks like: {
 *   handle: <dom element>
 *   data: <course data object from window.cdata>
 *   update_sects: <a function to update selected sections>
 * }
 * unbinds the schedule. */
function course(idx){
	let course_el = divclass("course");
	let title = divclass("title");
	let more = divclass("more");
	let out = {};
	let data = window.cdata[idx];
	let color = getcolor(data.c);
	let course_uuid = uuid(5);

	close = button("close", "✖");
	close.onclick = () => rmcourse(course_el);

	let course_warning = document.createElement("a");
	course_warning.classList.add("warn");
	course_warning.title = "you can't get any sections from this course";
	course_warning.innerHTML = "[!] ";
	let update_course_warning = () => {
		let boxes = course_el.$$(".sect_box");
		if(!boxes.some(b => b.checked))
			course_warning.style.display = "inline";
		else
			course_warning.style.display = "none";
	};

	let course_name = divclass("name");
	course_name.Ac(course_warning);
	course_name.Ac(document.createTextNode(data.n));

	title.Ac(course_name);
	title.Ac(close);
	title.onclick = function(){ tgcourse(this); };
	course_el.Ac(title);

	let sects = divclass("sects tab");
	let info_text = "";
	for(let i=0; i<data.s.length; i++){
		let s = data.s[i];

		info_text += "Section " + s.n + ": ";
		info_text += s.i.map(function(iindex) {
			return window.idata[iindex];
		}).join(', ') + "\n";
		info_text += s.c.map(c => {
			return "  " + c.d + " " + c.s + "-" + c.e;
		}).join("\n") + "\n";

		let time = s.t.map(t => {
			return days[t.d] + " " + toclock(t.s);
		}).join(" ");
		let iname_short = s.i.map((i, j) => {
			let iname = window.idata[i];
			if(j > 0 && iname === "STAFF") return null;
			let x = iname.split(" ");
			return x[0] + " " + x.slice(1).map(n => n[0]).join("");
		}).filter(x => x).join(",");

		let box = cbox();
		box.setAttribute("checked", true);
		box.id = uuid(5);
		box.classList.add("sect_box");

		let label = document.createElement("label");
		let box_warning = document.createElement("a");
		box_warning.classList.add("warn");
		box_warning.title = "ok, but this sect doesn't fit your criteria";
		box_warning.innerHTML = "[!] ";
		label.setAttribute("for", box.id);
		label.Ac(box_warning);
		label.Ac(document.createTextNode(s.n + ". " + iname_short + " " + time));

		/* warn user when enables an illegal sect
		 * impl'd here because here we know about the correct box */
		box.onchange = () => {
			if(box.checked && out.legal_sects.indexOf(i) < 0){
					box_warning.style.display = "inline";
			}else{
				box_warning.style.display = "none";
			}
			update_course_warning();
		};
		sects.Ac(box);
		sects.Ac(label);
	}

	/* TODO: add this toggle button to sects */
	let toggle = button("toggle", "toggle");
	toggle.onclick = function(){ tgboxes(this.parentNode); };

	/* update selected sects when a constraint changes
	 * impl'd here because here we know about the right course_el and out */
	let update_sects = () => {
		let check_dept = course_el.$(".dept").checked;
		let check_sn = course_el.$(".surname").checked;
		let legal_sects = compute_sects(window.cdata[idx], check_dept, check_sn);
		let sect_boxes = course_el.$$(".sect_box");
		for(let i=0; i<sect_boxes.length; i++){
			sect_boxes[i].checked = false;
		}
		for(let i=0; i<legal_sects.length; i++){
			sect_boxes[legal_sects[i]].checked = true;
		}
		out.legal_sects = legal_sects;
		sect_boxes.forEach(s => s.onchange());
		update_course_warning();
		unbind();
	}

	let checks = divclass("checks tab");
	let checks_row = divclass("checks-row");
	let add_check = function(label_text, check){
		let box = cbox();
		box.id = uuid(5);
		box.classList.add(label_text); /* easier to find in event handler */
		check && box.setAttribute("checked", true);
		let label = document.createElement("label");
		label.setAttribute("for", box.id);
		label.innerHTML = label_text;
		box.onchange = update_sects;
		checks_row.Ac(box);
		checks_row.Ac(label);
	}
	let p = document.createElement("p");
	p.innerHTML = "check for:"
	checks.Ac(p);

	add_check("surname", true);
	add_check("dept", true);
	add_check("collision", true);
	checks.Ac(checks_row);

	let p2 = document.createElement("p");
	p2.innerHTML = "or specify set of sections:"
	checks.Ac(p2);

	let selector = document.createElement("textarea");
	selector.placeholder = "some examples:\n" +
	"* \"1 or 2 or 5-15\"\n" +
	"* \"5 or not($crazy-mld-lady) and after(9:40)\"\n" +
	"[[ coming soon ]]";
	checks.Ac(selector);

	let info = divclass("info tab");
	info.innerHTML = info_text;

	let add_tab = function(el, label, check){
		let x = document.createElement("input");
		x.type = "radio";
		x.name = course_uuid;
		x.id = uuid(5);
		check && x.setAttribute("checked", true);
		let y = document.createElement("label");
		y.setAttribute("for", x.id);
		y.innerHTML = label;

		more.Ac(x);
		more.Ac(y);
		more.Ac(el);
	};

	add_tab(sects, "sections", true);
	add_tab(checks, "checks");
	add_tab(info, "info");

	course_el.Ac(more);
	$(".courses").Ac(course_el);

	/* on bootup */
	dither_element(course_el, color);
	update_sects();

	out.handle = course_el;
	out.data = window.cdata[idx];
	out.update_sects = update_sects;
	courses.push(out);
	return out;
}

/* open/close a course's accordion.
 * we use a 2011 setTimeout trick to avoid scrollbar flash */
function tgcourse(el){
	el.nextSibling.classList.toggle("show");
	let tabs = el.nextSibling.$$(".tab");
	tabs.forEach(x => x.classList.add("otw"));
	setTimeout(function(){
		tabs.forEach(x => x.classList.remove("otw"));
	}, 300);
}

/* toggle a course's boxes. used in toggle button. el is div.more. */
function tgboxes(el){
	let i, boxes = el.querySelectorAll("input[type=checkbox]");
	for(i=0; i<boxes.length; i++) boxes[i].checked = !boxes[i].checked;
}

/* get a course in courses from its handle.
 * searching in non-sorted array is slow but courses should be 10 items at most.
 * ES6 has map() which permits tying Objects together. take a look if this becomes trouble. */
function getcourse(el){
	for(let i=0; i<courses.length; i++)
		if(courses[i].handle === el) return courses[i];
}

/* remove a course via its DOM element.
 * the main use of this is X buttons on course titles. unbinds schedule. */
function rmcourse(el){
	courses.splice(courses.indexOf(getcourse(el)), 1);
	el.remove();
}

/* create a don't fill named n, on day d, from s to e.
 * the resulting node won't have any corresponding block until draw() is called.
 * can "unbind" the state if the resulting don't fill leaves no possible schedules.
 * TODO: checks for this so it does not set outside [start_time, end_time] */
function dontfill(d, s, e, n){
	/* does this new don't fill conflict with any in the array? */
	let df_conflicts = df => {
		let i;
		if(df.s < start_time || df.e < df.s) return true;
		for(i=0; i<dontfills.length; i++){
			if(df.d != dontfills[i].d) continue;
			if(df.s < dontfills[i].e && dontfills[i].s < df.e) return true;
		}
		return false;
	}

	let color = (n === "busy") ? dontfill_color : getcolor();

	for(let i=0; i<dontfills.length; i++){
		if(dontfills[i].c && dontfills[i].n === n)
			color = dontfills[i].c;
	}

	let out = {"n": n, "d": d, "s": s, "e": e, "c": color, "block": {}};
	if(df_conflicts(out))
		return;

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

/* remove a don't fill
 * triggers a compute() in bound mode
 * assumes there will be possible schedules. */
function rmdontfill(event, df){
	dontfills.splice(dontfills.indexOf(df), 1);
	df.block.remove();
	if(state === "bound")
		compute();
	draw();
	event.stopPropagation();
}

/* function eatdclick(event, el){
	let rect = el.getBoundingClientRect(), y = event.clientY - rect.top,
	mins = Math.round(start_time + (end_time - start_time) * (y) / rect.height),
	start = start_time + Math.floor((mins - start_time) / 60) * 60;
	dontfill(el.id, start, start+50, "Don't fill");
}
let eatds = grabclass("eatd");
for(i=0; i<eatds.length; i++) eatds[i].onclick = function(ev){ eatdclick(ev, this); }; */

/* handle a click on the schedule
 * we fake table cell behavior on that, rounding to nearest ..40:..30 block */
$("#tt").onclick = function(ev){
	let rect = this.getBoundingClientRect();
	let x = ev.clientX - rect.left;
	let y = ev.clientY - rect.top;

	let day = Math.floor(x * 5 / rect.width);
	let mins = start_time + (end_time - start_time) * y / rect.height;
	let start = start_time + Math.floor((mins - start_time) / 60) * 60;
	dontfill(day, start, start+50, "busy");
};

/* update selected sections when global dept and surname changes */
$("#dept").onchange = () => {
	courses.forEach(c => c.update_sects());
};

$("#surname").onchange = () => {
	courses.forEach(c => c.update_sects());
};

/* we also accept don't fills from the form.
function df_form(){
	let d = parseInt(grab("d").value);
	if(isNaN(d) || d < 1 || d > 5)
		return;
	let s = tomins(grab("s").value);
	let e = tomins(grab("e").value);
	if(isNaN(s) || isNaN(e))
		return;
	let n = grab("n").value || "Don't fill.";
	dontfill(d-1, s, e, n);
} */

/* draw the current state on the schedule table
 * first we get the latest hour on the schedule and adjust end_time. it defaults to 1050.
 * this can be easily extended to have adjustable start_time too, it is just that I have never seen a course before 8:40.
 * then we draw don't fills, then if state is not blank, we draw courses. there are don't fills in
 * schedules, we ignore them while drawing. */
function draw(){
	hideall();
	rmblocks();
	end_time = 1060;
	if(cursched >= schedules.length)
		cursched = 0;

	let sch = schedules[cursched] || [];
	if(schedules.length)
		$("#counter").innerHTML = (cursched+1).toString() + "/" + schedules.length;

	/* get end time, adjust schedule_height */
	dontfills.forEach(df => {
		if(df.e > end_time)
			end_time = df.e;
	});
	sch.forEach(t => {
		if(t.e > end_time)
			end_time = t.e;
	});
	if(end_time % 60 == 30)
		end_time += 10;
	schedule_height = (end_time - start_time) / 1.5;
	$("#tt").style.height = schedule_height + "px";

	/* draw blocks */
	sch.forEach(s => {
		let fc = frozen_courses[s.idx];
		if(fc){
			let b = block(s.d, s.s, s.e, fc.bg, fc.n + "/" + s.n);
			if(s.ph)
				b.style.opacity = 0.6;
		}
	});

	dontfills.forEach(d => {
		let b = block(d.d, d.s, d.e, df_bg, d.n);
		b.style.zIndex = 2;
		b.onclick = ev => rmdontfill(ev, d);
		d.block = b;
	});

	for(let i=0; i<dontfills.length; i++){
	}

	$("#start_time").innerHTML = toclock(start_time);
	$("#end_time").innerHTML = toclock(end_time);
	switch(state){
	case "blank":
		$("#state").innerHTML = "blank";
		return;
	case "unbound":
		$("#state").innerHTML = "detached - make to bind.";
		return;
	case "bound":
		$("#state").innerHTML = "bound";
		return;
	default: tantrum();
	}
}


/***
 * 4. schedule computation
 ***/

/* compute array of indices for legal sects
 * for given course data object.
 * next arguments are whether to check for dept and sn */
function compute_sects(C, check_dept, check_sn){
	let dept = $("#dept").value.toUpperCase();
	let sn = $("#surname").value.toUpperCase();
	let deptck = c => {
		if(!check_dept) return true;
		if(c.d === "ALL" || c.d === dept) return true;
		return false;
	};
	let snck = c => {
		if(!check_sn) return true;
		let cmp = function(x){ return sn.localeCompare(x, "tr"); };
		if(cmp(c.s) >= 0 && cmp(c.e) <= 0) return true;
		return false;
	}
	let out = [];
	for(let i=0; i<C.s.length; i++){
		let s = C.s[i];
		if(s.c.length === 0 || s.c.some(c => deptck(c) && snck(c)))
			out.push(i);
	}
	return out;
}

/* freeze names and bg images from current courses into
 * global array for ease of drawing (in case `courses` changes...) */
let frozen_courses = [];
function freeze_courses(){
	frozen_courses = [];
	for(let i=0; i<courses.length; i++){
		let C = courses[i];
		frozen_courses.push({
			n: C.data.n.split(" -")[0],
			bg: C.handle.style.backgroundImage
		});
	}
}

/* gather all selected sections from the DOM
 * meanwhile:
 * 1. add section number & index into frozen_courses for all time periods
 * 2. add "phantomness" data for all sections
 * 3. sort all the phantom sections to the end
 * returns array of course-ish objects but with time periods of sections collected */
function gather_sects(){
	let out = [];
	for(let i=0; i<courses.length; i++){
		let C = courses[i];
		let S = C.data.s;
		let course_el = C.handle;
		let boxes = course_el.$$(".sect_box");
		let new_c = {ts: []};
		for(let j=0; j<boxes.length; j++){
			let box = boxes[j];
			let s = S[j];
			if(!box.checked)
				continue;
			new_c.phantom = !course_el.$(".collision").checked;
			let ts_part = JSON.parse(JSON.stringify(s.t));
			ts_part.forEach(t => {
				t.idx = i;
				t.n = s.n;
				t.ph = new_c.phantom;
			});
			new_c.ts.push(ts_part);
		}
		out.push(new_c);
	}
	out.sort(function(a, b){ if(!a.phantom && b.phantom) return -1; return 1; });
	return out;
}

/* see if this schedule is viable.
 * we keep schedules as sorted arrays of time periods, so checking overlap is easy */
function viable(sch){
	let i;
	for(i=1; i<sch.length; i++)
		if(sch[i].d == sch[i-1].d && (sch[i].s < sch[i-1].e || sch[i].s == sch[i-1].s)) return false;
	return true;
}

/* tuck an array of time periods into our array of sorted time periods, return new array.
 * yes, this function is very specific and yes it clutters the Array prototype. (native tuck_multiple? :D)
 * however you can think of this as another part of the data monorail to compute().
 * tuck is simple binary search, finds an index to insert the new time period and then tucks it there. */
Array.prototype.tuck_multiple = function(times){
	let out = this.slice();
	let tuck = function(time){
		let lo = 0, hi = out.length, i;
		while(lo<hi){
			i = hi+lo >>> 1;
			if(time.d < out[i].d || (time.d == out[i].d && time.s < out[i].s)) hi = i;
			else lo = i+1;
		}
		out.splice(lo, 0, time);
	};
	for(let i=0; i<times.length; i++)
		tuck(times[i]);
	return out;
};

/* sort the schedule wrt day and start time. used to sort don't fills first */
function sortsch(sch){
	sch.sort(function(a, b){if(b.d < a.d || (b.d == a.d && b.s < a.s)) return 1; return -1;});
	return sch;
}

/* compute possible schedules. returns true if all went fine, false if no possible schedules.
 * kind of a tree search? */
function compute(){
	let out = [sortsch(dontfills)];
	let cs = gather_sects();
	for(let i=0; i<cs.length; i++){
		let c = cs[i];
		if(c.phantom) break;
		let out_nxt = [];
		for(let j=0; j<out.length; j++){
			for(let k=0; k<c.ts.length; k++){
				let part = out[j].tuck_multiple(c.ts[k]);
				if(viable(part)) out_nxt.push(part);
			}
		}
		out = out_nxt.slice();
	}
	for(;i<cs.length; i++){ /* now the phantom courses. */
		out_nxt = [];
		for(j=0; j<out.length; j++)
			for(k=0; k<sects[i].length; k++)
				out_nxt.push(out[j].concat(c.ts[k]));
		out = out_nxt.slice();
	}
	if(out.length === 0 || out[0].length === 0)
		return false;
	schedules = out;
	freeze_courses(); /* only overwrite if successful */
	return true;
}


/***
 * 5. stuff to do at startup and other random things
 ***/

/* top menu links and table overlays */
let els = [$("#about")];
function hideall(){
	for(let i=0; i<els.length; i++) els[i].style.display = "none";
}
function show(el){
	hideall();
	el.style.display = "block";
}

$("#about-link").onclick = () => show($("#about"));

$("#index").onclick = hideall;
$("#about").onclick = hideall;

/* make schedules, find state */
function make(){
	if(compute()) state = "bound";
	else alert("no schedules.");
	draw();
}
$("#make").onclick = make;

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

$("#prev").onclick = prev;
$("#next").onclick = next;

document.onkeydown = function(ev){
	if(ev.keyCode == "37") prev();
	if(ev.keyCode == "39") next();
};

/* we make the awesomplete list, together with course lookup table.
 * the lookup binds course names to window.cdata indices so we can utilize
 * javascript's hashtable to look for a named course. */
let i, j = [], lookup = {};
for(i=0; i<window.cdata.length; i++){
	j.push(window.cdata[i].n);
	lookup[window.cdata[i].n] = i;
}
new Awesomplete($("#course-auto"), {list: j});

$("#add-musts").onclick = function(){
	let i, musts = window.musts[$("#dept").value.toUpperCase()][$("#semester").value];
	for(i=0; i<musts.length; i++)
		course(musts[i]);
	if(courses[0])
		courses[0].handle.children[0].click();
}

$("#add-course").onclick = function(){
	course(lookup[$("#course-auto").value]);
};

/* remaining bound with those is hard */
// grab("sncheck").onchange = grab("surname").onchange = grab("nodeptcheck").onchange = grab("allphantom").onchange = unbind;

$("#save").onclick = save;
$("#fdate").innerHTML += window.fdate;

if(window.localStorage.getItem('state'))
	load();
else if(window.location.hash)
	load_legacy();

draw();

/***
 * 6. save/load
 ***/

/* the save link encodes the state in window.location.hash.
 * if we find a non-empty window.location.hash, we attempt to restore a state from it.
 * the state is stored like
 * {d: dontfills, n: current schedule, c: courses, dp: dept, t: term, sc, dc, ap: surname, dept, all phantom?, sn: surname}
 * the courses are stored like
 * {n: name, s: not checked sections, u, d, p: surname check, dept check, phantom checkboxes.}
 * TODO: pls make a shorthand for hnd.getElementsByClassName it is too long TOO MANy keystrokes */
function getstate(){
	let i, j, out = {};
	out.d = dontfills;
	out.n = cursched;
	out.c = [];
	for(i=0; i<courses.length; i++){
		let boxes, node = {}, hnd = courses[i].handle;
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
	return out;
}
let saved = false;
function save(){
	alert("sorry, we are not that close yet");
	return;
	window.localStorage.setItem('state', JSON.stringify(getstate()));
	alert("your settings are saved in your browser.");
	saved = true;
}
/* this does not errorcheck because there is no point providing feedback if someone put garbage in localStorage. */
function restorestate(st){
	let i, j;
	dontfills = st.d;
	for(i=0; i<st.c.length; i++){
		let c = course(lookup[st.c[i].n]),
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
	let h = window.localStorage.getItem('state');
	if(h) restorestate(JSON.parse(h));
}
function load_legacy(){
	let h = window.location.hash.replace(/^#/, "");
	if(h) restorestate(JSON.parse(atob(h)));
}

