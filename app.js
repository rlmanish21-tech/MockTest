import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const LIVE_PRACTICE_GRACE_MS=2*60*60*1000;
const cfg=window.LU_CONFIG||{};
const configured=cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.includes("YOUR-PROJECT")&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
const sb=configured?createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id);
function message(t,error=false){const e=$("message");if(!e)return;e.textContent=t;e.className="status show "+(error?"error":"ok")}
function studentAuthEmail(m){return "student-"+String(m).replace(/\D/g,"")+"@accounts.luupdate.in"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function localDateTimeInput(v){if(!v)return "";const d=new Date(v);if(Number.isNaN(d.getTime()))return "";const pad=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes())}
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
 if(!$("profile-name")&&!$("profile-line"))return;
 if(!need())return;
 try{
  let {user,p}=await profile();
  if(!user){location.href="login.html";return}
  if(!p){await recoverStudentProfile(user);return}
  const name=p.full_name||user.user_metadata?.full_name||"Student",course=p.course_name||"Course not set",stream=p.stream||"Stream not set";
  if($("welcome"))$("welcome").textContent="Welcome, "+name;
  const profileForm=$("profile-edit-form"),profileView=$("profile-view"),editButton=$("edit-profile-btn");
  const showProfile=(data)=>{
   const dob=data.date_of_birth?String(data.date_of_birth).slice(0,10):"Not provided";
   const put=(id,value)=>{const el=$(id);if(el)el.textContent=value||"Not provided"};
   put("profile-name",data.full_name||"Student");put("profile-mobile",data.mobile||"Not provided");put("profile-dob",dob);put("profile-stream",data.stream);put("profile-course",data.course_name);put("profile-qualification",data.qualification);put("profile-city",data.city);put("profile-state",data.state);put("profile-marketing",data.marketing_consent?"Opted in":"Not opted in");
   if($("profile-line"))$("profile-line").textContent=(data.course_name||"Course not set")+" · "+(data.stream||"Stream not set")+" · "+[data.city,data.state].filter(Boolean).join(", ");
   if($("welcome"))$("welcome").textContent="Welcome, "+(data.full_name||"Student");
   if($("hero-course"))$("hero-course").textContent=data.course_name||"Course not set";
   if($("stat-stream"))$("stat-stream").textContent=data.stream||"Not set";
  };
  const openProfileEditor=()=>{
   $("edit-full-name").value=p.full_name||"";
   $("edit-mobile").value=p.mobile||"";
   $("edit-dob").value=p.date_of_birth?String(p.date_of_birth).slice(0,10):"";
   $("edit-stream").value=p.stream||"Commerce";
   $("edit-course").value=p.course_name||"";
   $("edit-qualification").value=p.qualification||"";
   $("edit-city").value=p.city||"";
   $("edit-state").value=p.state||"";
   $("edit-marketing").checked=Boolean(p.marketing_consent);
   profileForm.hidden=false;profileView.hidden=true;editButton.hidden=true;
  };
  if(profileForm&&!profileForm.dataset.bound){
   profileForm.dataset.bound="1";
   editButton?.addEventListener("click",openProfileEditor);
   $("cancel-profile-btn")?.addEventListener("click",()=>{profileForm.hidden=true;profileView.hidden=false;editButton.hidden=false});
   profileForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const save=$("save-profile-btn");save.disabled=true;save.textContent="Saving…";
    const payload={full_name:$("edit-full-name").value.trim(),stream:$("edit-stream").value,course_name:$("edit-course").value.trim(),qualification:$("edit-qualification").value.trim(),city:$("edit-city").value.trim(),state:$("edit-state").value.trim(),marketing_consent:$("edit-marketing").checked};
    if(!payload.full_name||!payload.stream||!payload.course_name||!payload.qualification||!payload.city||!payload.state){message("Please complete all required profile fields.",true);save.disabled=false;save.textContent="Save changes";return}
    try{
     const {data:updated,error:updateError}=await sb.from("profiles").update(payload).eq("id",user.id).select("*").single();
     if(updateError)throw updateError;
     p=updated;showProfile(p);profileForm.hidden=true;profileView.hidden=false;editButton.hidden=false;
     message("Profile updated successfully. Your previous details have been replaced.");
    }catch(err){message("Profile could not be saved: "+(err?.message||String(err)),true)}
    finally{save.disabled=false;save.textContent="Save changes"}
   });
  }
  showProfile(p);
  if($("hero-course"))$("hero-course").textContent=course;
  if($("stat-stream"))$("stat-stream").textContent=stream;
  const {data:tests,error}=await sb.from("tests").select("id,title,test_type,status,duration_minutes,question_count,starts_at,ends_at,created_at").eq("status","published").order("created_at",{ascending:false});
  const {data:attempts, error:attemptError}=await sb.from("attempts").select("id,test_id,status,started_at,submitted_at,score,max_score").eq("student_id",user.id).order("started_at",{ascending:false});
  const {error:rankRefreshError}=await sb.rpc("refresh_my_result_ranks");if(rankRefreshError)console.warn("Automatic rank refresh unavailable. Apply supabase/automatic-results-and-ranks.sql in Supabase SQL Editor.",rankRefreshError.message);const {data:rs,error:resultError}=await sb.from("results").select("score,max_score,rank,test_id,published_at").eq("student_id",user.id).not("published_at","is",null);
  if($("stat-tests"))$("stat-tests").textContent=error?"—":String(tests?.length??0);
  if($("stat-results"))$("stat-results").textContent=resultError?"—":String(rs?.length??0);
  const latestByTest=new Map();(attempts||[]).forEach(a=>{if(!latestByTest.has(String(a.test_id)))latestByTest.set(String(a.test_id),a)});
  const fmtTime=v=>v?new Date(v).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}):"";
  const statusFor=t=>{const now=Date.now(),start=t.starts_at?new Date(t.starts_at).getTime():null,end=t.ends_at?new Date(t.ends_at).getTime():null;const practiceAvailable=t.test_type!=="live"||(end&&now>=end+LIVE_PRACTICE_GRACE_MS);if(practiceAvailable)return {state:"anytime",label:"Available anytime"};if(start&&now<start)return {state:"upcoming",label:"Starts in "+humanTime(start-now)};if(end&&now>=end)return {state:"ended",label:"Live test ended"};if(end&&end-now<3600000)return {state:"ending",label:"Live test ending in "+humanTime(end-now)};return {state:"live",label:end?"Live now · ends in "+humanTime(end-now):"Live now"}};
  const renderTests=()=>{
   const liveHost=$("tests"),practiceHost=$("practice-tests");
   if(error||attemptError){const errMsg=error?.message||attemptError?.message||"Unable to load tests.";const html='<div class="item">'+esc(errMsg)+'</div>';if(liveHost)liveHost.innerHTML=html;if(practiceHost)practiceHost.innerHTML=html;return}
   const now=Date.now();
   const liveTests=(tests||[]).filter(t=>t.test_type==="live"&&(!t.ends_at||now<new Date(t.ends_at).getTime()+LIVE_PRACTICE_GRACE_MS));
   const practiceTests=(tests||[]).filter(t=>t.test_type!=="live"||(t.ends_at&&now>=new Date(t.ends_at).getTime()+twoHours));
   const card=t=>{const a=latestByTest.get(String(t.id)),availability=statusFor(t),done=a&&a.status!=="in_progress",isLive=t.test_type==="live",locked=availability.state==="upcoming"||availability.state==="ended";let action="";
    if(a?.status==="in_progress")action='<button class="btn primary" data-start-attempt="'+t.id+'" data-resume="'+a.id+'">Resume attempt</button>';
    else action='<button class="btn primary" data-start-attempt="'+t.id+'" '+(locked?'disabled title="This live test is not open."':'')+'">'+(done?"Reattempt":"Attempt test")+'</button>';
    const analysis=done?'<a class="btn secondary" href="exam.html?attempt_id='+encodeURIComponent(a.id)+'&view=analysis" target="_blank" rel="noopener">View analysis</a>':"";
    const label=isLive?"Live test":t.test_type==="mock"?"Mock test":"Practice test";
    return '<article class="item student-test-card"><div class="student-test-card-head"><div><h3>'+esc(t.title)+'</h3><p class="muted">'+Number(t.question_count||0)+' questions · '+Number(t.duration_minutes||0)+' minutes</p><p class="small muted">'+esc(label)+(t.starts_at?" · Starts: "+esc(fmtTime(t.starts_at)):"")+(t.ends_at?" · Ends: "+esc(fmtTime(t.ends_at)):"")+'</p></div><span class="student-chip">'+(isLive?"LIVE TEST":t.test_type==="mock"?"MOCK TEST":"PRACTICE")+'</span></div><div class="test-availability '+esc(availability.state)+'" data-live-clock="'+t.id+'" data-start="'+esc(t.starts_at||"")+'" data-end="'+esc(t.ends_at||"")+'" data-kind="'+esc(t.test_type)+'">'+esc(availability.label)+'</div><div class="student-test-actions">'+action+analysis+'</div>'+(a?'<p class="small muted">Previous attempt: '+esc(a.status==="in_progress"?"In progress":a.submitted_at?fmtTime(a.submitted_at):"Submitted")+(a.score!==null&&a.score!==undefined?' · Score '+esc(a.score)+' / '+esc(a.max_score):"")+'</p>':"")+'</article>';
   };
   liveHost.innerHTML=liveTests.length?liveTests.map(card).join(""):'<div class="student-results-empty">No upcoming or recently completed live tests.</div>';
   practiceHost.innerHTML=practiceTests.length?practiceTests.map(card).join(""):'<div class="student-results-empty">No published practice tests are available yet.</div>';
   document.querySelectorAll("[data-start-attempt]").forEach(btn=>btn.addEventListener("click",async()=>{const tab=window.open("about:blank","_blank");btn.disabled=true;try{let attemptId=btn.dataset.resume;if(!attemptId){const {data,error}=await sb.rpc("start_test_attempt",{p_test_id:Number(btn.dataset.startAttempt)});if(error)throw error;attemptId=data?.attempt_id||data?.id||data;if(typeof attemptId==="object")attemptId=attemptId.attempt_id;if(!attemptId)throw new Error("The server did not return an attempt ID.");}if(tab)tab.location.href="exam.html?attempt_id="+encodeURIComponent(attemptId);else window.location.href="exam.html?attempt_id="+encodeURIComponent(attemptId);}catch(err){if(tab)tab.close();message("Could not start test: "+(err?.message||err),true)}finally{btn.disabled=false}}));
  };
  function humanTime(ms){const total=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h? h+"h "+m+"m":m?m+"m "+s+"s":s+"s"}
  renderTests();
  if(window.studentClockInterval)clearInterval(window.studentClockInterval);
  window.studentClockInterval=setInterval(()=>{const now=Date.now();document.querySelectorAll("[data-live-clock]").forEach(el=>{const start=el.dataset.start?new Date(el.dataset.start).getTime():null,end=el.dataset.end?new Date(el.dataset.end).getTime():null;if(el.dataset.kind!=="live")return;if(start&&now<start)el.textContent="Starts in "+humanTime(start-now);else if(end&&now>=end)el.textContent="Live test ended";else if(end&&end-now<3600000)el.textContent="Live test ending in "+humanTime(end-now);else el.textContent=end?"Live now · ends in "+humanTime(end-now):"Live now";});if((tests||[]).some(t=>t.test_type==="live"&&t.ends_at&&now>=new Date(t.ends_at).getTime()+7200000&&now<new Date(t.ends_at).getTime()+7201500))renderTests();},1000);
  $("results").innerHTML=resultError?'<div class="student-results-empty">Published results could not be loaded: '+esc(resultError.message)+'</div>':rs?.length?rs.map(r=>{const t=(tests||[]).find(x=>String(x.id)===String(r.test_id));const rankText=r.rank!==null&&r.rank!==undefined?String(r.rank):(t?.test_type==="live"&&t.ends_at&&Date.now()<new Date(t.ends_at).getTime()?"Available after live test window ends":"Updating rank");return '<div class="item"><h3>'+esc(t?.title||"Test result")+'</h3><p class="muted">Score: '+esc(r.score)+' / '+esc(r.max_score)+' · Rank: '+esc(rankText)+'</p></div>'}).join(""):'<div class="student-results-empty">No published results yet. Once a result is released, it will appear here.</div>';
 }catch(err){message("Could not load your profile: "+(err?.message||String(err)),true);if($("profile-name"))$("profile-name").textContent="Profile unavailable";if($("hero-course"))$("hero-course").textContent="Course unavailable";if($("profile-line"))$("profile-line").textContent="Please refresh or sign in again."}
}
async function logout(id,redirect){const b=$(id);if(b)b.addEventListener("click",async()=>{if(sb)await sb.auth.signOut();location.href=redirect})}
async function adminLogin(){const f=$("admin-login-form");if(!f)return;f.addEventListener("submit",async e=>{e.preventDefault();if(!need())return;const {data,error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){message("Owner login failed: "+error.message,true);return}const {data:isAdmin,error:roleError}=await sb.rpc("is_admin");if(roleError){await sb.auth.signOut();message("Could not verify owner access: "+roleError.message,true);return}if(isAdmin!==true){await sb.auth.signOut();message("Signed in, but this account is not authorised for owner access. Check the admin role for this exact Auth user.",true);return}location.href="admin-dashboard.html"})}
async function adminDash(){if(!$("admin-tests"))return;if(!need())return;const {data:{user},error:userError}=await sb.auth.getUser();if(userError||!user){location.href="admin.html";return}const {data:isAdmin,error:roleError}=await sb.rpc("is_admin");if(roleError||isAdmin!==true){message("Owner access verification failed. Please sign in again.",true);await sb.auth.signOut();location.href="admin.html";return}await loadCourses();await loadTests();await loadQuestions();await loadSchedules();await loadResults();await loadOwnerOverview();await loadStudents();$("export-students").addEventListener("click",exportStudentsCsv);$("course-form").addEventListener("submit",async e=>{e.preventDefault();const {error}=await sb.from("courses").insert({name:$("course-name").value.trim(),stream:$("course-stream").value,is_active:true});if(error)message(error.message,true);else{message("Course added.");$("course-form").reset();await loadCourses()}});document.addEventListener("click",e=>{const picker=$("course-picker");if(picker&&!picker.contains(e.target)){$("course-picker-menu").hidden=true;$("course-picker-trigger").setAttribute("aria-expanded","false")}});$("refresh-tests")?.addEventListener("click",async()=>{const btn=$("refresh-tests");btn.disabled=true;btn.textContent="Refreshing…";try{await loadTests();await loadOwnerOverview();message("Tests refreshed.");}catch(err){message("Refresh failed: "+(err?.message||err),true)}finally{btn.disabled=false;btn.textContent="↻ Refresh"}});$("upload-extracted-questions")?.addEventListener("click",async()=>{const b=$("upload-extracted-questions");b.disabled=true;try{const ok=await saveImportedQuestions();if(ok===true){$("question-extraction-title").textContent="All questions uploaded successfully.";$("question-extraction-detail").textContent="Questions and correct answers are saved. You can now publish the test.";b.textContent="Questions uploaded ✓";$("publish-created-test").disabled=false;}}catch(err){message("Could not upload questions: "+(err?.message||err),true)}finally{b.disabled=false}});
$("publish-created-test")?.addEventListener("click",async()=>{if(!pendingCreatedTestId){message("Create a test and extract its questions first.",true);return}const b=$("publish-created-test");b.disabled=true;try{if(!extractedQuestionsSaved){const ok=await saveImportedQuestions();if(ok!==true){message("Questions could not be uploaded. Fix the error before publishing.",true);return}extractedQuestionsSaved=true}const {data:test,error:te}=await sb.from("tests").select("id,question_count").eq("id",pendingCreatedTestId).single();if(te||!test){message("Could not verify test: "+(te?.message||"Test not found"),true);return}const {data:qs,error:qe}=await sb.from("questions").select("id").eq("test_id",pendingCreatedTestId);if(qe){message(qe.message,true);return}if((qs||[]).length!==test.question_count){message("Cannot publish: expected "+test.question_count+" questions, but "+(qs||[]).length+" are saved.",true);return}const {data:keys,error:ke}=await sb.from("answer_keys").select("question_id").in("question_id",(qs||[]).map(q=>q.id));if(ke){message(ke.message,true);return}if((keys||[]).length!==(qs||[]).length){message("Cannot publish: some questions are missing correct answers.",true);return}const {error:pe}=await sb.from("tests").update({status:"published"}).eq("id",pendingCreatedTestId);if(pe){message("Could not publish test: "+pe.message,true);return}message("Test published successfully with "+(qs||[]).length+" questions and answer keys.");$("question-extraction-actions").hidden=true;pendingCreatedTestId=null;pendingImportedQuestions=null;extractedQuestionsSaved=false;await loadTests();await loadOwnerOverview()}catch(err){message("Publishing failed: "+(err?.message||err),true)}finally{b.disabled=false}});
const testTypeSelect=$("test-type"),testScheduleFields=$("test-schedule-fields");const syncTestCreationSchedule=()=>{const live=testTypeSelect.value==="live";testScheduleFields.hidden=!live;$("test-start").required=live;$("test-end").required=live};testTypeSelect.addEventListener("change",syncTestCreationSchedule);syncTestCreationSchedule();$("test-form").noValidate=true;$("test-form").addEventListener("submit",async e=>{e.preventDefault();const isLive=$("test-type").value==="live";if(isLive){const start=$("test-start").value,end=$("test-end").value;if(!start||!end){message("For a live mock test, enter both the start and end date/time.",true);return}if(new Date(end)<=new Date(start)){message("The live test end time must be later than its start time.",true);return}}const courseIds=[...$("test-course").selectedOptions].map(o=>Number(o.value));if(!courseIds.length){message("Select at least one course.",true);return}const payload={title:$("test-title").value.trim(),course_id:courseIds[0],test_type:$("test-type").value,duration_minutes:Number($("test-duration").value),question_count:Number($("test-count").value),starts_at:isLive?new Date($("test-start").value).toISOString():null,ends_at:isLive?new Date($("test-end").value).toISOString():null,created_by:user.id,status:"draft"};const {data:created,error}=await sb.from("tests").insert(payload).select("id").single();if(error){message(error.message,true);return}const {error:courseError}=await sb.from("test_courses").insert(courseIds.map(course_id=>({test_id:created.id,course_id})));if(courseError){message("Test created, but course assignments failed. Run the multi-course migration in Supabase. "+courseError.message,true);await loadTests();return}message("Draft test created. Upload its Excel/CSV file from the test card below to extract and save questions before publishing.");$("test-form").reset();await loadTests();await loadOwnerOverview();});$("admin-logout").addEventListener("click",async()=>{await sb.auth.signOut();location.href="admin.html"})}
let ownerStudentRows=[];
let pendingImportedQuestions=null;
let pendingCreatedTestId=null;
let extractedQuestionsSaved=false;
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
 sel.innerHTML=active.map(c=>'<option value="'+c.id+'">'+esc(c.name)+' — '+esc(c.stream)+'</option>').join("");
 const optionHost=$("course-picker-options"),summary=$("course-picker-summary"),menu=$("course-picker-menu"),trigger=$("course-picker-trigger");
 if(optionHost&&summary&&menu&&trigger){
  const previouslySelected=new Set([...sel.selectedOptions].map(o=>o.value));
  optionHost.innerHTML=active.length?active.map(c=>'<label class="course-picker-option"><input type="checkbox" value="'+c.id+'" '+(previouslySelected.has(String(c.id))?'checked':'')+'><span>'+esc(c.name)+' — '+esc(c.stream)+'</span></label>').join(""):'<div class="course-picker-empty">No active courses. Add or reactivate a course first.</div>';
  const syncPicker=()=>{const checked=[...optionHost.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);[...sel.options].forEach(o=>o.selected=checked.includes(o.value));summary.textContent=checked.length?checked.map(id=>active.find(c=>String(c.id)===id)?.name||"Course").join(", "):"Choose one or more courses";};
  optionHost.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.addEventListener("change",syncPicker));
  trigger.onclick=()=>{const open=menu.hidden;menu.hidden=!open;trigger.setAttribute("aria-expanded",String(open));};
  $("course-picker-done").onclick=()=>{menu.hidden=true;trigger.setAttribute("aria-expanded","false");};
  if(!previouslySelected.size)syncPicker();else {summary.textContent=[...previouslySelected].map(id=>active.find(c=>String(c.id)===id)?.name).filter(Boolean).join(", ")||"Choose one or more courses";}
 }
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
async function importExcelQuestions(e,options={}){
 e.preventDefault();
 if(!window.XLSX){message("Excel reader is not available. Refresh the page and try again.",true);return}
 const testId=options.testId||$("question-test").value,file=options.file||$("question-excel").files?.[0],help=$("excel-import-help");
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
  if((existing||[]).length+dataRows.length!==test.question_count)throw new Error("This test requires exactly "+test.question_count+" questions. The spreadsheet contains "+dataRows.length+" question rows and "+(existing||[]).length+" are already saved. Set the test question count to match the file, or correct the spreadsheet, then create the test again.");
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
  pendingImportedQuestions={testId:Number(testId),fileName:file.name,rows:parsed};
  if(options.autoSave){return await saveImportedQuestions()}
  return true;
  const preview=$("question-import-preview");
  if(preview){preview.hidden=false;preview.innerHTML='<div class="item"><strong>Ready to save: '+parsed.length+' questions</strong><p class="muted small">File: '+esc(file.name)+' · Correct options validated. Review the count, then click Save imported questions.</p></div>'}
  const saveButton=$("save-imported-questions");if(saveButton)saveButton.hidden=false;
  message("Import checked successfully. Review the question count and click Save imported questions.");
  if(help)help.textContent="Validated "+parsed.length+" questions from "+file.name+". They have not been saved yet.";
  if(!options.file)$("excel-question-form").reset();
 }catch(err){
  if(help)help.textContent=err.message||String(err);
  message("Excel import failed: "+(err.message||String(err)),true);
  return false;
 }
}
async function saveImportedQuestions(){
 if(!pendingImportedQuestions){message("Import a valid spreadsheet first.",true);return false}
 const {testId,rows,fileName}=pendingImportedQuestions;
 const {data:test,error:te}=await sb.from("tests").select("id,status,question_count").eq("id",testId).single();
 if(te||!test){message("Could not verify selected test: "+(te?.message||"Test not found"),true);return false}
 if(test.status!=="draft"){message("Only draft tests can be edited. Create a draft or unpublish this test first.",true);return false}
 const {data:existing,error:qe}=await sb.from("questions").select("id,question_order").eq("test_id",testId);
 if(qe){message(qe.message,true);return false}
 if((existing||[]).length+rows.length>test.question_count){message("Question count changed since import. Please import again.",true);return false}
 const insertRows=rows.map(({_correct,...q})=>q);
 const {data:saved,error:saveError}=await sb.from("questions").insert(insertRows).select("id,question_order");
 if(saveError){message("Questions could not be saved: "+saveError.message,true);return false}
 const correctByOrder=new Map(rows.map(q=>[q.question_order,q._correct]));
 const keys=(saved||[]).map(q=>({question_id:q.id,correct_option:correctByOrder.get(Number(q.question_order))}));
 const {error:keyError}=await sb.from("answer_keys").insert(keys);
 if(keyError){const ids=(saved||[]).map(q=>q.id);if(ids.length)await sb.from("questions").delete().in("id",ids);message("Answer keys could not be saved; imported questions were rolled back. "+keyError.message,true);return false}
 pendingImportedQuestions=null;
 extractedQuestionsSaved=true;
 const preview=$("question-import-preview");if(preview){preview.hidden=true;preview.innerHTML=""}
 const button=$("save-imported-questions");if(button)button.hidden=true;
 message("Saved "+saved.length+" questions and answer keys from "+fileName+".");
 await loadQuestions();await loadTests();await loadOwnerOverview();
 return true;
}
async function loadTests(){
 const {data,error}=await sb.from("tests").select("id,title,status,test_type,duration_minutes,question_count,starts_at,ends_at,course_id").order("created_at",{ascending:false});
 const rows=data||[];
 const courseIds=[...new Set(rows.map(t=>t.course_id).filter(Boolean))];
 const {data:courseRows}=courseIds.length?await sb.from("courses").select("id,name,stream").in("id",courseIds):{data:[]};
 const courseName=new Map((courseRows||[]).map(x=>[Number(x.id),x.name+" — "+x.stream]));
 const readiness=await Promise.all(rows.map(async t=>{const {data:qs,error:qe}=await sb.from("questions").select("id").eq("test_id",t.id);if(qe)return {...t,savedCount:0,answerCount:0,ready:false};const questions=qs||[];const {data:keys,error:ke}=questions.length?await sb.from("answer_keys").select("question_id").in("question_id",questions.map(q=>q.id)):{data:[],error:null};const answerCount=ke?0:(keys||[]).length;return {...t,savedCount:questions.length,answerCount,ready:!ke&&questions.length===Number(t.question_count)&&answerCount===questions.length}}));
 $("admin-tests").innerHTML=error?'<div class="item">'+esc(error.message)+'</div>':readiness.length?readiness.map(t=>{
 const live=t.test_type==="live",type=live?"live":"practice",ready=t.ready;
 const uploadArea=t.status==="published"?"":'<div class="question-upload-card"><div class="field"><label for="excel-'+t.id+'">Upload question paper (Excel / CSV)</label><input id="excel-'+t.id+'" type="file" accept=".xlsx,.xls,.csv" data-question-file="'+t.id+'"><small class="muted small">Columns A–G: question number, question, options A–D, correct option (A/B/C/D). Required: '+t.question_count+' questions.</small></div><div class="owner-action-buttons"><button type="button" class="btn secondary" data-extract-questions="'+t.id+'">Extract & upload questions</button><span class="question-upload-status" id="upload-status-'+t.id+'" role="status">'+(ready?'✓ All '+t.savedCount+' questions and answer keys are saved.':t.savedCount?'Saved '+t.savedCount+' / '+t.question_count+' questions; '+t.answerCount+' answer keys.':'Upload a file to begin extraction.')+'</span></div></div>';
 return '<form class="item test-admin-row" data-test-row="'+t.id+'" style="padding:16px;margin:0 0 12px;border:1px solid #edf0f6;border-radius:12px;background:#fff"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 6px">'+esc(t.title)+'</h3><p class="muted small" style="margin:0">'+esc(courseName.get(Number(t.course_id))||"Assigned course")+' · '+t.duration_minutes+' min · '+t.question_count+' questions · '+esc(t.status)+'</p></div><strong class="small">'+(t.status==="published"?"PUBLISHED":ready?"READY TO PUBLISH":"DRAFT — QUESTIONS REQUIRED")+'</strong></div>'+uploadArea+'<div class="owner-form-grid" style="margin-top:14px"><div class="field"><label>Test nature</label><select name="test_type"><option value="practice" '+(type==="practice"?"selected":"")+'>Practice Test — anytime</option><option value="live" '+(live?"selected":"")+'>Live Mock Test — scheduled</option></select></div><div class="field test-time-field" '+(!live?'hidden':'')+'><label>Start date & time</label><input type="datetime-local" name="starts_at" value="'+(t.starts_at?localDateTimeInput(t.starts_at):"")+'" '+(live?'required':'')+'></div><div class="field test-time-field" '+(!live?'hidden':'')+'><label>End date & time</label><input type="datetime-local" name="ends_at" value="'+(t.ends_at?localDateTimeInput(t.ends_at):"")+'" '+(live?'required':'')+'></div></div><div class="owner-action-buttons" style="justify-content:flex-end;margin-top:12px"><button class="btn secondary" type="submit" name="action" value="save">Save details</button><button class="btn primary" type="submit" name="action" value="publish" '+(!ready&&t.status!=="published"?"disabled title=\"Upload and validate the complete question paper first\"":"")+'>'+(t.status==="published"?"Save changes & Republish":"Publish test")+'</button><button class="btn secondary delete-test-btn" type="button" data-delete-test="'+t.id+'">Delete test</button></div></form>';
 }).join(""):'<div class="item">No tests created yet.</div>';
 document.querySelectorAll("[data-test-row]").forEach(form=>{form.noValidate=true;const typeSelect=form.elements.test_type,fields=[...form.querySelectorAll(".test-time-field")];const sync=()=>{const live=typeSelect.value==="live";fields.forEach(w=>{w.hidden=!live;w.querySelector("input").required=live})};typeSelect.addEventListener("change",sync);sync();form.addEventListener("submit",async e=>{e.preventDefault();const action=e.submitter?.value||"save",id=Number(form.dataset.testRow),type=typeSelect.value;let starts_at=null,ends_at=null;if(type==="live"){const s=form.elements.starts_at.value,en=form.elements.ends_at.value;if(!s||!en){message("For a Live Mock Test, enter start and end date/time.",true);return}const sd=new Date(s),ed=new Date(en);if(Number.isNaN(sd.getTime())||Number.isNaN(ed.getTime())||ed<=sd){message("End time must be later than start time.",true);return}starts_at=sd.toISOString();ends_at=ed.toISOString()}if(action==="publish"){const {data:test,error:te}=await sb.from("tests").select("id,question_count").eq("id",id).single();if(te){message(te.message,true);return}const {data:qs,error:qe}=await sb.from("questions").select("id").eq("test_id",id);if(qe){message(qe.message,true);return}const questions=qs||[];if(questions.length!==test.question_count){message("Cannot publish: upload exactly "+test.question_count+" questions first.",true);return}const {data:keys,error:ke}=await sb.from("answer_keys").select("question_id").in("question_id",questions.map(q=>q.id));if(ke){message(ke.message,true);return}if((keys||[]).length!==questions.length){message("Cannot publish: some questions are missing correct answers.",true);return}}const {error:saveError}=await sb.from("tests").update({test_type:type,starts_at,ends_at,...(action==="publish"?{status:"published"}:{})}).eq("id",id);if(saveError){message("Could not save test: "+saveError.message,true);return}message(action==="publish"?"Test published successfully.":"Test details saved.");await loadTests();await loadOwnerOverview()})});
 document.querySelectorAll("[data-extract-questions]").forEach(button=>button.addEventListener("click",async()=>{const id=Number(button.dataset.extractQuestions),fileInput=$('excel-'+id),status=$('upload-status-'+id),file=fileInput?.files?.[0];if(!file){if(status){status.className="question-upload-status error";status.textContent="Choose an Excel or CSV file first."}message("Choose an Excel or CSV file first.",true);return}button.disabled=true;button.textContent="Extracting…";if(status){status.className="question-upload-status";status.textContent="Reading and validating every question…"}try{pendingImportedQuestions=null;const ok=await importExcelQuestions({preventDefault(){}},{testId:id,file});if(ok!==true||!pendingImportedQuestions){const msg=$("message")?.textContent||"The spreadsheet could not be validated.";if(status){status.className="question-upload-status error";status.textContent=msg}return}const count=pendingImportedQuestions.rows.length;if(status)status.textContent="Validation passed. Saving "+count+" questions and answer keys…";const saved=await saveImportedQuestions();if(saved!==true){const msg=$("message")?.textContent||"Question upload failed.";if(status){status.className="question-upload-status error";status.textContent=msg}return}message("All "+count+" questions uploaded successfully, including correct answers.");await loadTests()}catch(err){const msg=err?.message||String(err);if(status){status.className="question-upload-status error";status.textContent=msg}message("Question extraction failed: "+msg,true)}finally{button.disabled=false;button.textContent="Extract & upload questions"}}));
 document.querySelectorAll("[data-delete-test]").forEach(b=>b.addEventListener("click",async()=>{const id=Number(b.dataset.deleteTest);if(!confirm("Permanently delete this test, its questions, all student attempts, saved answers, and results? This cannot be undone."))return;const {error:delError}=await sb.from("tests").delete().eq("id",id);if(delError){message("Could not delete test. If the database migration has not been run, run supabase/multi-course-migration.sql in Supabase SQL Editor. Details: "+delError.message,true);return}message("Test deleted.");await loadTests();await loadQuestions();await loadOwnerOverview()}));
}
async function loadSchedules(){
 const host=$("schedule-tests");if(!host)return;
 const {data:tests,error}=await sb.from("tests").select("id,title,status,test_type,duration_minutes,question_count,starts_at,ends_at").order("created_at",{ascending:false});
 if(error){host.innerHTML='<div class="item">Could not load tests: '+esc(error.message)+'</div>';return}
 const rows=tests||[];
 if(!rows.length){host.innerHTML='<div class="item">No tests yet. First create a draft in the Tests section.</div>';return}
 const counts=await Promise.all(rows.map(async t=>{
  const {count,error:ce}=await sb.from("questions").select("id",{count:"exact",head:true}).eq("test_id",t.id);
  const {data:qs,error:qe}=await sb.from("questions").select("id").eq("test_id",t.id);
  let answerCount=0;
  if(!qe&&qs?.length){const {count:ac,error:ae}=await sb.from("answer_keys").select("question_id",{count:"exact",head:true}).in("question_id",qs.map(q=>q.id));if(!ae)answerCount=ac||0}
  return {...t,savedCount:ce?null:(count??0),answerCount};
 }));
 const localValue=localDateTimeInput;
 host.innerHTML=counts.map(t=>{
  const countLabel=t.savedCount===null?"Could not check":t.savedCount+" / "+t.question_count+" questions imported";
  const complete=t.savedCount===t.question_count&&t.answerCount===t.question_count;
  const canPublish=complete&&t.status!=="published";
  const type=t.test_type||"practice";
  const isLive=type==="live";
  return '<form class="item schedule-test-form" data-schedule-test="'+t.id+'" style="padding:18px;margin:0 0 14px;border:1px solid #edf0f6;border-radius:12px;background:#fff">'+
   '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 7px">'+esc(t.title)+'</h3><p class="muted small" style="margin:0">'+(isLive?"Live mock test — fixed time window":type==="mock"?"Normal mock test — available anytime":"Practice test — available anytime")+' · '+t.duration_minutes+' minutes · '+esc(t.status)+'</p></div><strong style="font-size:12px;color:'+(complete?'#16845d':'#a66a10')+'">'+esc(countLabel)+'</strong></div>'+
   '<p class="muted small" style="margin:10px 0 14px">'+(complete?'Question paper and answer keys are complete.':('Need '+Math.max(0,t.question_count-(t.savedCount||0))+' more question(s); answer keys saved for '+t.answerCount+'.'))+'</p>'+
   '<div class="owner-form-grid"><div class="field"><label>Availability / test type</label><select name="test_type"><option value="practice" '+(type==="practice"?"selected":"")+'>Practice test — anyone can attempt anytime</option><option value="mock" '+(type==="mock"?"selected":"")+'>Normal mock test — anyone can attempt anytime</option><option value="live" '+(isLive?"selected":"")+'>Live mock test — fixed start and end time</option></select></div><div class="field schedule-datetime" '+(!isLive?'hidden':'')+'><label>Test start date & time</label><input type="datetime-local" name="starts_at" value="'+localValue(t.starts_at)+'" '+(isLive?'required':'')+'></div><div class="field schedule-datetime" '+(!isLive?'hidden':'')+'><label>Test end date & time</label><input type="datetime-local" name="ends_at" value="'+localValue(t.ends_at)+'" '+(isLive?'required':'')+'></div></div>'+
   '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn secondary" type="submit" name="action" value="save">Save availability</button><button class="btn primary" type="submit" name="action" value="publish" '+(!canPublish?'disabled':'')+'>'+(t.status==="published"?'Already published':'Save & publish')+'</button></div>'+
   (t.status==="published"?'<p class="muted small">This test is published. Live-test time restrictions still need to be enforced by the timed exam/attempt workflow.</p>':'')+
   '</form>';
 }).join("");
 host.querySelectorAll("[data-schedule-test]").forEach(form=>{
  form.noValidate=true; // Validate schedule fields in JS so failures always show a message.
  const typeSelect=form.elements.test_type;
  const dateFields=[...form.querySelectorAll(".schedule-datetime")];
  const syncAvailability=()=>{const live=typeSelect.value==="live";dateFields.forEach(w=>{w.hidden=!live;const input=w.querySelector("input");input.required=live})};
  typeSelect.addEventListener("change",syncAvailability);syncAvailability();
  form.addEventListener("submit",async e=>{
   e.preventDefault();
   const btn=e.submitter,action=btn?.value||"save",id=form.dataset.scheduleTest,type=form.elements.test_type.value;
   const start=form.elements.starts_at.value,end=form.elements.ends_at.value;
   let startsAt=null,endsAt=null;
   if(type==="live"){
    if(!start||!end){message("For a live mock test, enter both the start and end date/time.",true);return}
    startsAt=new Date(start);endsAt=new Date(end);
    if(Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime())||endsAt<=startsAt){message("The live test end time must be later than its start time.",true);return}
   }
   if(action==="publish"){
    const {data:test,error:te}=await sb.from("tests").select("id,question_count,status").eq("id",id).single();
    if(te){message("Could not verify test: "+te.message,true);return}
    const {data:qs,error:qe}=await sb.from("questions").select("id").eq("test_id",id);
    if(qe){message("Could not check imported questions: "+qe.message,true);return}
    const questions=qs||[];
    if(questions.length!==test.question_count){message("Cannot publish yet. This test needs exactly "+test.question_count+" questions; "+questions.length+" are saved.",true);return}
    const {data:keys,error:ke}=await sb.from("answer_keys").select("question_id").in("question_id",questions.map(q=>q.id));
    if(ke){message("Could not verify answer keys: "+ke.message,true);return}
    if((keys||[]).length!==questions.length){message("Cannot publish yet. Some imported questions are missing correct answers.",true);return}
   }
   const payload={test_type:type,starts_at:startsAt?startsAt.toISOString():null,ends_at:endsAt?endsAt.toISOString():null};
   if(action==="publish")payload.status="published";
   const {error:saveError}=await sb.from("tests").update(payload).eq("id",id);
   if(saveError){message("Could not save availability: "+saveError.message,true);return}
   message(action==="publish"?"Availability saved and test published.":"Test availability saved.");
   await loadSchedules();await loadTests();await loadOwnerOverview();
  });
 });
}
async function loadResults(){const {data,error}=await sb.from("results").select("id,student_id,test_id,score,max_score,rank,published_at").order("created_at",{ascending:false}).limit(100);$("admin-results").innerHTML=error?'<div class="item">'+esc(error.message)+'</div>':data?.length?data.map(r=>'<div class="item row"><span>Result #'+r.id+' · '+esc(r.score)+'/'+esc(r.max_score)+' · '+(r.published_at?"Published":"Pending review")+'</span><button class="btn secondary" data-result="'+r.id+'" '+(r.published_at?"disabled":"")+'>Approve</button></div>').join(""):'<div class="item">No results to review yet.</div>';document.querySelectorAll("[data-result]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await sb.from("results").update({published_at:new Date().toISOString()}).eq("id",b.dataset.result);if(error)message(error.message,true);else{message("Result published.");await loadResults()}}))}
document.addEventListener("DOMContentLoaded",()=>{initRegistrationCourses();register();login();studentDash();logout("logout","index.html");adminLogin();adminDash()});