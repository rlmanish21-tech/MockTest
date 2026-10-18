import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.LU_CONFIG||{};
const configured=cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.includes("YOUR-PROJECT")&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
const sb=configured?createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id);
function message(t,error=false){const e=$("message");if(!e)return;e.textContent=t;e.className="status show "+(error?"error":"ok")}
function studentAuthEmail(m){return "student-"+String(m).replace(/\D/g,"")+"@accounts.luupdate.in"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function need(){if(!sb){message("Supabase is not configured. Add your project URL and publishable/anon key in config.js.",true);return false}return true}
async function profile(){const {data:{user},error:userError}=await sb.auth.getUser();if(userError)throw userError;if(!user)return {user:null,p:null};const {data:p,error:profileError}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();if(profileError)throw profileError;return {user,p}}
async function initRegistrationCourses(){
 const stream=$("stream"),course=$("course"),help=$("course-help");
 if(!stream||!course)return;
 if(!need())return;
 let courses=[];
 course.disabled=true;
 course.innerHTML='<option value="">Loading courses…</option>';
 async function fetchCourses(){
  if(help)help.textContent="Loading active courses from LU Update…";
  const {data,error}=await sb.from("courses").select("id,name,stream").eq("is_active",true).order("name");
  if(error){
   course.innerHTML='<option value="">Unable to load courses</option>';
   course.disabled=true;
   if(help)help.textContent="Course list could not load ("+error.message+"). Please refresh or contact the administrator.";
   return false;
  }
  courses=data||[];
  refreshOptions();
  return true;
 }
 function refreshOptions(){
  const selectedStream=stream.value;
  const choices=courses.filter(item=>item.stream===selectedStream);
  course.innerHTML='<option value="">'+(selectedStream?"Select a course":"Select stream first")+'</option>'+choices.map(item=>'<option value="'+esc(item.name)+'">'+esc(item.name)+'</option>').join("");
  course.disabled=!selectedStream||choices.length===0;
  if(help)help.textContent=!selectedStream?"Choose a stream to see active courses.":choices.length?choices.length+" active course(s) available.":"No active courses are listed for this stream. Ask the owner to add and activate courses.";
 }
 stream.addEventListener("change",async()=>{await fetchCourses()});
 await fetchCourses();
}
async function register(){const f=$("register-form");if(!f)return;f.addEventListener("submit",async e=>{e.preventDefault();if(!need())return;const mobile=$("mobile").value.trim(),dob=$("dob").value;if(!/^\d{10}$/.test(mobile)||!dob){message("Enter a valid 10-digit mobile number and date of birth.",true);return}const profileData={full_name:$("full_name").value.trim(),mobile,date_of_birth:dob,stream:$("stream").value,course_name:$("course").value.trim(),state:$("state").value.trim(),city:$("city").value.trim(),qualification:$("qualification").value,marketing_consent:$("marketing").checked};const {data,error}=await sb.auth.signUp({email:studentAuthEmail(mobile),password:dob,options:{data:profileData}});if(error){message(error.message,true);return}if(!data.session){message("Registration was created but no active session was returned. Ensure Confirm email is OFF, then log in with your mobile number and date of birth.",true);return}const {data:p,error:pe}=await sb.from("profiles").select("id").eq("id",data.user.id).maybeSingle();if(pe||!p){message("Your account was created, but the database did not create the student profile. Please contact support and share this message: profile trigger missing or failed.",true);return}message("Registration successful. Your profile has been saved. You can now use the student dashboard.");f.reset()})}
async function login(){const f=$("login-form");if(!f)return;f.addEventListener("submit",async e=>{e.preventDefault();if(!need())return;const m=$("mobile").value.trim(),dob=$("dob").value;if(!/^\d{10}$/.test(m)||!dob){message("Enter your registered mobile number and date of birth.",true);return}const {error}=await sb.auth.signInWithPassword({email:studentAuthEmail(m),password:dob});if(error){message("Login failed. Check your mobile number and date of birth. If this is your first login, register first.",true);return}location.href="dashboard.html"})}
async function recoverStudentProfile(user){const box=$("message");const guessedMobile=(user.email?.match(/^student-(\d+)@accounts\.luupdate\.in$/i)||[])[1]||"";box.className="status show error";box.innerHTML='<strong>Your account exists, but its student profile is missing.</strong><p style="margin:8px 0">Complete the details below once to finish setting up your dashboard.</p><form id="recover-profile-form"><label class="field">Full name<input id="recover-name" required maxlength="120" value="'+esc(user.user_metadata?.full_name||"")+'"></label><label class="field">Mobile number<input id="recover-mobile" required inputmode="numeric" pattern="[0-9]{10}" maxlength="10" value="'+esc(guessedMobile)+'"></label><label class="field">Date of birth<input id="recover-dob" type="date" required></label><label class="field">Stream<select id="recover-stream" required><option value="">Choose stream</option><option>Commerce</option><option>Science</option><option>Arts</option></select></label><label class="field">Course / exam name<input id="recover-course" required maxlength="150" placeholder="e.g. B.Com Entrance"></label><div class="form-grid"><label class="field">State<input id="recover-state" required maxlength="100"></label><label class="field">City<input id="recover-city" required maxlength="100"></label></div><label class="field">Highest qualification<input id="recover-qualification" required maxlength="100" placeholder="e.g. Class 12"></label><button class="btn primary full" type="submit">Save profile and continue</button></form>';const form=$("recover-profile-form");form.addEventListener("submit",async e=>{e.preventDefault();const mobile=$("recover-mobile").value.trim(),dob=$("recover-dob").value;if(!/^\\d{10}$/.test(mobile)){message("Enter a valid 10-digit mobile number.",true);return}const payload={id:user.id,full_name:$("recover-name").value.trim(),mobile,date_of_birth:dob,stream:$("recover-stream").value,course_name:$("recover-course").value.trim(),state:$("recover-state").value.trim(),city:$("recover-city").value.trim(),qualification:$("recover-qualification").value.trim(),marketing_consent:false,role:"student"};const {error}=await sb.from("profiles").insert(payload);if(error){message("Profile could not be saved: "+error.message,true);return}message("Profile saved. Loading your dashboard…");await studentDash()})}
async function studentDash(){
 if(!$("profile-line"))return;
 if(!need())return;
 try{
  const {user,p}=await profile();
  if(!user){location.href="login.html";return}
  if(!p){await recoverStudentProfile(user);return}
  const name=p.full_name||user.user_metadata?.full_name||"Student";
  const course=p.course_name||"Course not set";
  const stream=p.stream||"Stream not set";
  if($("welcome"))$("welcome").textContent="Welcome, "+name;
  if($("profile-name"))$("profile-name").textContent=name;
  if($("profile-line"))$("profile-line").textContent=course+" · "+stream+" · "+[p.city,p.state].filter(Boolean).join(", ");
  if($("hero-course"))$("hero-course").textContent=course;
  if($("stat-stream"))$("stat-stream").textContent=stream;
  const {data:tests,error}=await sb.from("tests").select("id,title,test_type,duration_minutes,question_count,starts_at,ends_at").eq("status","published").order("created_at",{ascending:false});
  if($("stat-tests"))$("stat-tests").textContent=error?"—":String(tests?.length??0);
  $("tests").innerHTML=error?'<div class="item">Tests could not be loaded: '+esc(error.message)+'</div>':tests?.length?tests.map(t=>'<div class="item student-test-card"><div class="student-test-card-head"><div><h3>'+esc(t.title)+'</h3><p class="muted">'+esc(t.test_type)+' · '+t.duration_minutes+' minutes · '+t.question_count+' questions</p></div><span class="student-chip">'+(t.test_type==="live"?"LIVE TEST":"PRACTICE")+'</span></div><button class="btn secondary" type="button" data-preview-test="'+t.id+'">View questions ↓</button><div id="question-preview-'+t.id+'" class="student-question-preview" hidden></div><p class="small muted">Question preview only. Timed attempts and answer submission are not enabled yet.</p></div>').join(""):'<div class="item">No published tests available yet.</div>';
  $("tests").querySelectorAll("[data-preview-test]").forEach(btn=>btn.addEventListener("click",async()=>{
   const id=btn.dataset.previewTest,container=$("question-preview-"+id);
   if(!container)return;
   if(!container.hidden){container.hidden=true;btn.textContent="View questions ↓";return}
   container.hidden=false;container.innerHTML='<div class="student-results-empty">Loading questions…</div>';btn.textContent="Hide questions ↑";
   const {data:qs,error:qError}=await sb.from("questions").select("id,question_text,option_a,option_b,option_c,option_d,question_order").eq("test_id",id).order("question_order");
   if(qError){container.innerHTML='<div class="student-results-empty">Questions could not be loaded: '+esc(qError.message)+'</div>';return}
   container.innerHTML=qs?.length?qs.map(q=>'<article class="student-question-card"><div class="student-question-number">QUESTION '+q.question_order+'</div><h4>'+esc(q.question_text)+'</h4><div class="student-question-options"><div><span>A</span>'+esc(q.option_a)+'</div><div><span>B</span>'+esc(q.option_b)+'</div><div><span>C</span>'+esc(q.option_c)+'</div><div><span>D</span>'+esc(q.option_d)+'</div></div></article>').join(""):'<div class="student-results-empty">No questions have been added to this test yet.</div>';
  }));
  const {data:rs,error:resultError}=await sb.from("results").select("score,max_score,rank,test_id").eq("student_id",user.id).not("published_at","is",null);
  if($("stat-results"))$("stat-results").textContent=resultError?"—":String(rs?.length??0);
  $("results").innerHTML=resultError?'<div class="student-results-empty">Published results could not be loaded: '+esc(resultError.message)+'</div>':rs?.length?rs.map(r=>'<div class="item"><h3>Test result</h3><p class="muted">Score: '+esc(r.score)+' / '+esc(r.max_score)+' · Rank: '+esc(r.rank??"Pending")+'</p></div>').join(""):'<div class="student-results-empty">No published results yet. Once a result is released, it will appear here.</div>';
 }catch(err){
  message("Could not load your profile: "+(err?.message||String(err)),true);
  if($("profile-name"))$("profile-name").textContent="Profile unavailable";
  if($("hero-course"))$("hero-course").textContent="Course unavailable";
  if($("profile-line"))$("profile-line").textContent="Please refresh or sign in again.";
 }
}
async function logout(id,redirect){const b=$(id);if(b)b.addEventListener("click",async()=>{if(sb)await sb.auth.signOut();location.href=redirect})}
async function adminLogin(){const f=$("admin-login-form");if(!f)return;f.addEventListener("submit",async e=>{e.preventDefault();if(!need())return;const {data,error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){message("Owner login failed: "+error.message,true);return}const {data:isAdmin,error:roleError}=await sb.rpc("is_admin");if(roleError){await sb.auth.signOut();message("Could not verify owner access: "+roleError.message,true);return}if(isAdmin!==true){await sb.auth.signOut();message("Signed in, but this account is not authorised for owner access. Check the admin role for this exact Auth user.",true);return}location.href="admin-dashboard.html"})}
async function adminDash(){if(!$("admin-tests"))return;if(!need())return;const {data:{user},error:userError}=await sb.auth.getUser();if(userError||!user){location.href="admin.html";return}const {data:isAdmin,error:roleError}=await sb.rpc("is_admin");if(roleError||isAdmin!==true){message("Owner access verification failed. Please sign in again.",true);await sb.auth.signOut();location.href="admin.html";return}await loadCourses();await loadTests();await loadQuestions();await loadResults();await loadOwnerOverview();await loadStudents();$("export-students").addEventListener("click",exportStudentsCsv);$("course-form").addEventListener("submit",async e=>{e.preventDefault();const {error}=await sb.from("courses").insert({name:$("course-name").value.trim(),stream:$("course-stream").value,is_active:true});if(error)message(error.message,true);else{message("Course added.");$("course-form").reset();await loadCourses()}});$("question-test").addEventListener("change",loadQuestions);$("question-form").addEventListener("submit",saveQuestion);$("excel-question-form").addEventListener("submit",importExcelQuestions);$("download-question-template").addEventListener("click",downloadQuestionTemplate);$("test-form").addEventListener("submit",async e=>{e.preventDefault();const payload={title:$("test-title").value.trim(),course_id:Number($("test-course").value),test_type:$("test-type").value,duration_minutes:Number($("test-duration").value),question_count:Number($("test-count").value),starts_at:$("test-start").value?new Date($("test-start").value).toISOString():null,ends_at:$("test-end").value?new Date($("test-end").value).toISOString():null,created_by:user.id,status:"draft"};const {error}=await sb.from("tests").insert(payload);if(error)message(error.message,true);else{message("Draft test created. Questions and publishing workflow are next.");$("test-form").reset();await loadTests()}});$("admin-logout").addEventListener("click",async()=>{await sb.auth.signOut();location.href="admin.html"})}
let ownerStudentRows=[];
async function loadOwnerOverview(){
 const specs=[
  ["stat-courses","courses","id"],
  ["stat-tests","tests","id"],
  ["stat-students","profiles","id"]
 ];
 for(const [el,table,col] of specs){const {count,error}=await sb.from(table).select(col,{count:"exact",head:true});const node=$(el);if(node)node.textContent=error?"—":String(count??0)}
 const {count,error}=await sb.from("results").select("id",{count:"exact",head:true}).is("published_at",null);
 if($("stat-pending"))$("stat-pending").textContent=error?"—":String(count??0);
}
async function loadStudents(){
 const body=$("admin-students");if(!body)return;
 const {data,error}=await sb.from("profiles").select("full_name,mobile,stream,course_name,state,city,role").eq("role","student").order("created_at",{ascending:false}).limit(1000);
 if(error){body.innerHTML='<tr><td colspan="5">Could not load student records: '+esc(error.message)+'</td></tr>';return}
 ownerStudentRows=data||[];
 body.innerHTML=ownerStudentRows.length?ownerStudentRows.map(s=>'<tr><td>'+esc(s.full_name)+'</td><td>'+esc(s.mobile)+'</td><td>'+esc(s.stream)+'</td><td>'+esc(s.course_name)+'</td><td>'+esc([s.city,s.state].filter(Boolean).join(", "))+'</td></tr>').join(""):'<tr><td colspan="5">No student profiles found yet.</td></tr>';
}
function exportStudentsCsv(){
 if(!ownerStudentRows.length){message("There are no student records to export yet.",true);return}
 const fields=["full_name","mobile","stream","course_name","city","state"];
 const csv=[["Full name","Mobile","Stream","Course / exam","City","State"],...ownerStudentRows.map(s=>fields.map(k=>String(s[k]??"")))].map(row=>row.map(v=>'"'+v.replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const blob=new Blob(["\\ufeff",csv],{type:"text/csv;charset=utf-8;"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="lu-update-student-records.csv";a.click();URL.revokeObjectURL(url);
}
async function loadCourses(){
 const {data,error}=await sb.from("courses").select("id,name,stream,is_active").order("name");
 if(error){message(error.message,true);return}
 const rows=data||[];
 $("courses").innerHTML=rows.length?rows.map(c=>'<div class="item row"><div><h3>'+esc(c.name)+'</h3><p class="muted small">'+esc(c.stream)+' · '+(c.is_active?'Active':'Inactive')+'</p></div><div class="owner-action-buttons"><button class="btn secondary" type="button" data-toggle-course="'+c.id+'" data-active="'+c.is_active+'">'+(c.is_active?'Deactivate':'Reactivate')+'</button><button class="btn secondary" type="button" data-delete-course="'+c.id+'">Delete</button></div></div>').join(""):'<div class="item">No courses yet. Add a course above.</div>';
 const active=rows.filter(c=>c.is_active);
 const sel=$("test-course");
 sel.innerHTML=active.length?active.map(c=>'<option value="'+c.id+'">'+esc(c.name)+' — '+esc(c.stream)+'</option>').join(""):'<option value="">Add and activate a course first</option>';
 document.querySelectorAll("[data-toggle-course]").forEach(b=>b.addEventListener("click",async()=>{
  const activeNow=b.dataset.active==="true";
  const {error}=await sb.from("courses").update({is_active:!activeNow}).eq("id",b.dataset.toggleCourse);
  if(error){message("Could not update course: "+error.message,true);return}
  message(activeNow?"Course deactivated and removed from student registration.":"Course reactivated and available for registration.");
  await loadCourses();
 }));
 document.querySelectorAll("[data-delete-course]").forEach(b=>b.addEventListener("click",async()=>{
  if(!confirm("Permanently delete this course? This only works if no tests are linked to it. Deactivating is safer if you want to preserve history."))return;
  const {error}=await sb.from("courses").delete().eq("id",b.dataset.deleteCourse);
  if(error){message("Course was not deleted. It may be linked to existing tests. Deactivate it instead, or remove linked tests first. Details: "+error.message,true);return}
  message("Course permanently deleted.");await loadCourses();await loadOwnerOverview();
 }));
}
async function loadQuestions(){
 const select=$("question-test"),list=$("admin-questions"),progress=$("question-progress");
 if(!select||!list)return;
 const id=select.value;
 if(!id){list.innerHTML="";if(progress)progress.textContent="Select a test to view its questions.";return}
 const {data:test,error:te}=await sb.from("tests").select("id,title,question_count,status").eq("id",id).single();
 if(te){message(te.message,true);return}
 const {data:qs,error}=await sb.from("questions").select("id,question_text,option_a,option_b,option_c,option_d,marks,negative_marks,question_order").eq("test_id",id).order("question_order");
 if(error){message(error.message,true);return}
 const rows=qs||[];
 const {data:keys,error:ke}=rows.length?await sb.from("answer_keys").select("question_id,correct_option").in("question_id",rows.map(q=>q.id)):{data:[],error:null};
 if(ke){message(ke.message,true);return}
 const km=new Map((keys||[]).map(k=>[String(k.question_id),k.correct_option]));
 if(progress)progress.textContent="Saved "+rows.length+" of "+test.question_count+" required questions; answer keys saved for "+km.size+". Status: "+test.status;
 list.innerHTML=rows.length?rows.map(q=>'<div class="item"><strong>Q'+q.question_order+'. '+esc(q.question_text)+'</strong><p class="muted small">A. '+esc(q.option_a)+' · B. '+esc(q.option_b)+' · C. '+esc(q.option_c)+' · D. '+esc(q.option_d)+'</p><p class="muted small">Correct: '+esc(km.get(String(q.id))||"MISSING")+' · Marks: '+esc(q.marks)+' · Negative: '+esc(q.negative_marks)+'</p><button class="btn secondary" type="button" data-delete-question="'+q.id+'" '+(test.status==="published"?"disabled":"")+'>Remove question</button></div>').join(""):'<div class="item">No questions added yet.</div>';
 document.querySelectorAll("[data-delete-question]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Remove this question and its answer key?"))return;const {error}=await sb.from("questions").delete().eq("id",b.dataset.deleteQuestion);if(error)message(error.message,true);else{message("Question removed.");await loadQuestions()}}));
 $("question-form").querySelectorAll("input,textarea,select,button").forEach(el=>{if(el.id!=="question-test")el.disabled=test.status==="published"});
}
async function saveQuestion(e){
 e.preventDefault();
 const testId=$("question-test").value;
 if(!testId){message("Select a test first.",true);return}
 const {data:test,error:te}=await sb.from("tests").select("id,status,question_count").eq("id",testId).single();
 if(te){message(te.message,true);return}
 if(test.status!=="draft"){message("Only draft tests can be edited.",true);return}
 const {data:rows,error:qe}=await sb.from("questions").select("id,question_order").eq("test_id",testId).order("question_order");
 if(qe){message(qe.message,true);return}
 if((rows||[]).length>=test.question_count){message("This test already has its required question count.",true);return}
 const order=(rows||[]).reduce((n,q)=>Math.max(n,Number(q.question_order)||0),0)+1;
 const payload={test_id:Number(testId),question_text:$("question-text").value.trim(),option_a:$("option-a").value.trim(),option_b:$("option-b").value.trim(),option_c:$("option-c").value.trim(),option_d:$("option-d").value.trim(),marks:Number($("question-marks").value),negative_marks:Number($("question-negative").value),question_order:order};
 if(!payload.question_text||![payload.option_a,payload.option_b,payload.option_c,payload.option_d].every(Boolean)){message("Enter the question and all four options.",true);return}
 const {data:q,error}=await sb.from("questions").insert(payload).select("id").single();
 if(error){message("Could not save question: "+error.message,true);return}
 const {error:ke}=await sb.from("answer_keys").insert({question_id:q.id,correct_option:$("correct-option").value});
 if(ke){await sb.from("questions").delete().eq("id",q.id);message("Answer key failed to save; question was rolled back. "+ke.message,true);return}
 message("Question "+order+" saved.");
 $("question-form").reset();$("question-marks").value="1";$("question-negative").value="0";
 await loadQuestions();
}
function downloadQuestionTemplate(){
 if(!window.XLSX){message("Excel helper has not loaded yet. Refresh the page and try again.",true);return}
 const rows=[["Question Number","Question","Option A","Option B","Option C","Option D","Correct Option"],[1,"What is the capital of India?","Mumbai","New Delhi","Kolkata","Chennai","B"],[2,"Which one is a prime number?","9","15","17","21","C"]];
 const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:18},{wch:48},{wch:24},{wch:24},{wch:24},{wch:24},{wch:18}];XLSX.utils.book_append_sheet(wb,ws,"Questions");XLSX.writeFile(wb,"LU-Update-Question-Template.xlsx");
}
async function importExcelQuestions(e){
 e.preventDefault();
 if(!window.XLSX){message("Excel reader is not available. Refresh the page and try again.",true);return}
 const testId=$("question-test").value,file=$("question-excel").files?.[0],help=$("excel-import-help");
 if(!testId){message("Select a draft test in Question Editor before importing.",true);return}
 if(!file){message("Choose an Excel or CSV file first.",true);return}
 const {data:test,error:te}=await sb.from("tests").select("id,title,status,question_count").eq("id",testId).single();
 if(te){message("Could not load selected test: "+te.message,true);return}
 if(test.status!=="draft"){message("Questions can only be imported into a draft test.",true);return}
 try{
  if(help)help.textContent="Reading and validating spreadsheet…";
  const buffer=await file.arrayBuffer();
  const wb=XLSX.read(buffer,{type:"array"});
  const first=wb.SheetNames[0];
  if(!first)throw new Error("The file contains no worksheet.");
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[first],{header:1,defval:"",raw:false,blankrows:false});
  if(!matrix.length)throw new Error("The worksheet is empty.");
  const cell=s=>String(s??"").trim();
  const firstRow=matrix[0].map(x=>cell(x).toLowerCase());
  const hasHeader=firstRow.some(x=>x.includes("question"))||firstRow.some(x=>x==="option a")||firstRow.some(x=>x==="correct option");
  const dataRows=(hasHeader?matrix.slice(1):matrix).filter(row=>row.some(v=>cell(v)!==""));
  if(!dataRows.length)throw new Error("No question rows were found. Use columns A–G as specified.");
  if(dataRows.length>500)throw new Error("Import is limited to 500 questions per upload.");
  const {data:existing,error:qe}=await sb.from("questions").select("id,question_order").eq("test_id",testId);
  if(qe)throw new Error("Could not check existing questions: "+qe.message);
  if((existing||[]).length+dataRows.length>test.question_count)throw new Error("This test allows "+test.question_count+" questions. It already has "+(existing||[]).length+"; this upload contains "+dataRows.length+".");
  const used=new Set((existing||[]).map(q=>Number(q.question_order)));
  const seen=new Set();
  const parsed=[];
  for(let i=0;i<dataRows.length;i++){
   const row=dataRows[i]||[];
   const line=i+(hasHeader?2:1);
   const rawNo=cell(row[0]),number=Number(rawNo),question=cell(row[1]),opts=[cell(row[2]),cell(row[3]),cell(row[4]),cell(row[5])],correct=cell(row[6]).toUpperCase().replace(/^OPTION\s*/,"");
   if(!rawNo||!Number.isInteger(number)||number<1)throw new Error("Row "+line+": column A must contain a positive integer question number.");
   if(used.has(number)||seen.has(number))throw new Error("Row "+line+": question number "+number+" is duplicated in this test or file.");
   if(!question)throw new Error("Row "+line+": question text in column B is blank.");
   if(opts.some(x=>!x))throw new Error("Row "+line+": all four options in columns C–F are required.");
   if(!["A","B","C","D"].includes(correct))throw new Error("Row "+line+": column G must be A, B, C or D.");
   seen.add(number);
   parsed.push({test_id:Number(testId),question_text:question,option_a:opts[0],option_b:opts[1],option_c:opts[2],option_d:opts[3],marks:1,negative_marks:0,question_order:number,_correct:correct});
  }
  const insertRows=parsed.map(({_correct,...q})=>q);
  const {data:saved,error:saveError}=await sb.from("questions").insert(insertRows).select("id,question_order");
  if(saveError)throw new Error("Questions were not saved: "+saveError.message);
  const correctByOrder=new Map(parsed.map(q=>[q.question_order,q._correct]));
  const keys=(saved||[]).map(q=>({question_id:q.id,correct_option:correctByOrder.get(Number(q.question_order))}));
  const {error:keyError}=await sb.from("answer_keys").insert(keys);
  if(keyError){
   const ids=(saved||[]).map(q=>q.id);
   if(ids.length)await sb.from("questions").delete().in("id",ids);
   throw new Error("Answer keys could not be saved; the imported questions were rolled back. "+keyError.message);
  }
  message("Imported "+saved.length+" questions with answer keys.");
  if(help)help.textContent="Successfully imported "+saved.length+" questions from "+file.name+".";
  $("excel-question-form").reset();
  await loadQuestions();
 }catch(err){
  if(help)help.textContent=err.message||String(err);
  message("Excel import failed: "+(err.message||String(err)),true);
 }
}
async function loadTests(){
 const {data,error}=await sb.from("tests").select("id,title,status,test_type,duration_minutes,question_count").order("created_at",{ascending:false});
 const rows=data||[];
 $("admin-tests").innerHTML=error?'<div class="item">'+esc(error.message)+'</div>':rows.length?rows.map(t=>'<div class="item row"><div><h3>'+esc(t.title)+'</h3><p class="muted small">'+esc(t.test_type)+' · '+t.duration_minutes+' min · '+t.question_count+' questions · '+esc(t.status)+'</p></div><div class="owner-action-buttons"><button class="btn secondary" data-publish="'+t.id+'" '+(t.status==="published"?"disabled":"")+'>Publish</button><button class="btn secondary" data-delete-test="'+t.id+'">Delete test</button></div></div>').join(""):'<div class="item">No tests created yet.</div>';
 const selector=$("question-test"),previous=selector.value;
 selector.innerHTML=rows.length?'<option value="">Select a test</option>'+rows.map(t=>'<option value="'+t.id+'">'+esc(t.title)+' ('+esc(t.status)+')</option>').join(""):'<option value="">Create a test first</option>';
 if(rows.some(t=>String(t.id)===previous))selector.value=previous;
 document.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",async()=>{
  const id=b.dataset.publish;
  const {data:test,error:te}=await sb.from("tests").select("id,question_count").eq("id",id).single();
  if(te){message("Could not check test: "+te.message,true);return}
  const {data:qs,error:qe}=await sb.from("questions").select("id").eq("test_id",id);
  if(qe){message("Could not validate questions: "+qe.message,true);return}
  const questions=qs||[];
  if(questions.length!==test.question_count){message("Cannot publish: add exactly "+test.question_count+" questions first. Currently saved: "+questions.length+".",true);return}
  const {data:keys,error:ke}=await sb.from("answer_keys").select("question_id").in("question_id",questions.map(q=>q.id));
  if(ke){message("Could not verify answer keys: "+ke.message,true);return}
  if((keys||[]).length!==questions.length){message("Cannot publish: one or more questions are missing a correct answer.",true);return}
  const {error}=await sb.from("tests").update({status:"published"}).eq("id",id);
  if(error)message("Could not publish test: "+error.message,true);else{message("Test published. The timed student test-taking workflow still needs to be built.");await loadTests();await loadOwnerOverview()}
 }));
 document.querySelectorAll("[data-delete-test]").forEach(b=>b.addEventListener("click",async()=>{
  if(!confirm("Permanently delete this test and its questions? Existing attempts or results may prevent deletion to protect records."))return;
  const {error}=await sb.from("tests").delete().eq("id",b.dataset.deleteTest);
  if(error){message("Test was not deleted. Existing attempts or results may refer to it. Details: "+error.message,true);return}
  message("Test and its questions permanently deleted.");await loadTests();await loadQuestions();await loadOwnerOverview();
 }));
}
async function loadResults(){const {data,error}=await sb.from("results").select("id,student_id,test_id,score,max_score,rank,published_at").order("created_at",{ascending:false}).limit(100);$("admin-results").innerHTML=error?'<div class="item">'+esc(error.message)+'</div>':data?.length?data.map(r=>'<div class="item row"><span>Result #'+r.id+' · '+esc(r.score)+'/'+esc(r.max_score)+' · '+(r.published_at?"Published":"Pending review")+'</span><button class="btn secondary" data-result="'+r.id+'" '+(r.published_at?"disabled":"")+'>Approve</button></div>').join(""):'<div class="item">No results to review yet.</div>';document.querySelectorAll("[data-result]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await sb.from("results").update({published_at:new Date().toISOString()}).eq("id",b.dataset.result);if(error)message(error.message,true);else{message("Result published.");await loadResults()}}))}
document.addEventListener("DOMContentLoaded",()=>{initRegistrationCourses();register();login();studentDash();logout("logout","index.html");adminLogin();adminDash()});