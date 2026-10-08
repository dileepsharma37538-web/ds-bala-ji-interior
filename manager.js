import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCf9-h9Pofvtdldbi4ID7q-AELzo19fL7E",
  authDomain: "ds-bala-ji-interior.firebaseapp.com",
  projectId: "ds-bala-ji-interior",
  storageBucket: "ds-bala-ji-interior.firebasestorage.app",
  messagingSenderId: "564291814619",
  appId: "1:564291814619:web:ce649d7bdffb63e4e9f8fe",
  measurementId: "G-V9D8D04SRD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const loginForm = document.querySelector('#loginForm');
const loginError = document.querySelector('#loginError');
const today = new Date().toISOString().slice(0,10);
document.querySelector('#attDate').value = today;
document.querySelector('#payDate').value = today;

let workers = [];
let editingProjectId = null;
const SERVICE_LIST = [
  {key:'furniture', name:'Furniture & Woodwork', number:'01'},
  {key:'civil', name:'Civil Work', number:'02'},
  {key:'painting', name:'Painting & Finishing', number:'03'},
  {key:'interior', name:'Interior Solutions', number:'04'}
];

function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function safeFileName(name){return name.replace(/[^a-zA-Z0-9._-]/g,'_')}
function toast(message, good=true){const el=document.querySelector('#managerToast');el.textContent=message;el.className='toast '+(good?'show good':'show bad');setTimeout(()=>el.className='toast',3200)}

loginForm.addEventListener('submit', async e => {
  e.preventDefault(); loginError.textContent = '';
  try { await signInWithEmailAndPassword(auth, document.querySelector('#email').value.trim(), document.querySelector('#password').value); }
  catch(err){ loginError.textContent = 'Login failed. Check manager email/password.'; }
});

onAuthStateChanged(auth, async user => {
  if(!user){loginView.classList.remove('hidden');appView.classList.add('hidden');return;}
  loginView.classList.add('hidden');appView.classList.remove('hidden');
  document.querySelector('#managerEmail').textContent=user.email||'';
  await refreshAll();
});

document.querySelector('#logout').onclick=()=>signOut(auth);
document.querySelector('#logoutMobile').onclick=()=>signOut(auth);

document.querySelectorAll('aside button[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));
  document.querySelector('#'+btn.dataset.tab).classList.remove('hidden');
  document.querySelectorAll('aside button[data-tab]').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  if(btn.dataset.tab==='services') renderProjects();
  if(btn.dataset.tab==='gallery') renderGallery();
}));

async function refreshAll(){
  workers=[];
  const ws=await getDocs(collection(db,'workers')); ws.forEach(d=>workers.push({id:d.id,...d.data()}));
  fillWorkerSelects();renderWorkers();await renderAttendance();await renderPayments();await loadBusiness();
  await renderProjects();await renderGallery();
  document.querySelector('#workerCount').textContent=workers.length;
}
function fillWorkerSelects(){for(const id of ['attWorker','payWorker']){const s=document.querySelector('#'+id);s.innerHTML='<option value="">Choose worker</option>'+workers.map(w=>`<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('')}}

document.querySelector('#workerForm').addEventListener('submit',async e=>{e.preventDefault();await addDoc(collection(db,'workers'),{name:workerName.value.trim(),role:workerRole.value.trim(),phone:workerPhone.value.trim(),createdAt:serverTimestamp()});e.target.reset();await refreshAll();toast('Worker added.')});
function renderWorkers(){const el=document.querySelector('#workersList');if(!workers.length){el.innerHTML='<div class="empty">No workers added yet.</div>';return}el.innerHTML='<table><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th></th></tr></thead><tbody>'+workers.map(w=>`<tr><td>${escapeHtml(w.name)}</td><td>${escapeHtml(w.role||'-')}</td><td>${escapeHtml(w.phone||'-')}</td><td><button data-del-worker="${w.id}">Delete</button></td></tr>`).join('')+'</tbody></table>';el.querySelectorAll('[data-del-worker]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this worker?')){await deleteDoc(doc(db,'workers',b.dataset.delWorker));await refreshAll();toast('Worker deleted.')}})}

document.querySelector('#saveAttendance').onclick=async()=>{if(!attWorker.value||!attDate.value)return alert('Select date and worker.');await addDoc(collection(db,'attendance'),{date:attDate.value,workerId:attWorker.value,status:attStatus.value,createdAt:serverTimestamp()});await renderAttendance();toast('Attendance saved.')};
async function renderAttendance(){const snap=await getDocs(collection(db,'attendance'));let rows=[],present=0;snap.forEach(d=>{const x={id:d.id,...d.data()};const w=workers.find(z=>z.id===x.workerId);if(x.date===today&&x.status==='Present')present++;rows.push({...x,worker:w?.name||'Deleted worker'})});rows.sort((a,b)=>(b.date||'').localeCompare(a.date||''));document.querySelector('#presentCount').textContent=present;document.querySelector('#attendanceList').innerHTML=rows.length?'<table><thead><tr><th>Date</th><th>Worker</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${x.date}</td><td>${escapeHtml(x.worker)}</td><td>${escapeHtml(x.status)}</td><td><button data-del-att="${x.id}">Delete</button></td></tr>`).join('')+'</tbody></table>':'<div class="empty">No attendance records yet.</div>';document.querySelectorAll('[data-del-att]').forEach(b=>b.onclick=async()=>{await deleteDoc(doc(db,'attendance',b.dataset.delAtt));await renderAttendance();toast('Attendance deleted.')})}

document.querySelector('#savePayment').onclick=async()=>{if(!payWorker.value||!payDate.value||!payAmount.value)return alert('Select worker, date and amount.');await addDoc(collection(db,'payments'),{date:payDate.value,workerId:payWorker.value,amount:Number(payAmount.value),note:payNote.value.trim(),createdAt:serverTimestamp()});payAmount.value='';payNote.value='';await renderPayments();toast('Payment saved.')};
async function renderPayments(){const snap=await getDocs(collection(db,'payments'));let rows=[],total=0;snap.forEach(d=>{const x={id:d.id,...d.data()};const w=workers.find(z=>z.id===x.workerId);total+=Number(x.amount||0);rows.push({...x,worker:w?.name||'Deleted worker'})});rows.sort((a,b)=>(b.date||'').localeCompare(a.date||''));document.querySelector('#paymentCount').textContent=rows.length;document.querySelector('#paidTotal').textContent='₹'+total.toLocaleString('en-IN');document.querySelector('#paymentsList').innerHTML=rows.length?'<table><thead><tr><th>Date</th><th>Worker</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${x.date}</td><td>${escapeHtml(x.worker)}</td><td>₹${Number(x.amount||0).toLocaleString('en-IN')}</td><td>${escapeHtml(x.note||'-')}</td><td><button data-del-pay="${x.id}">Delete</button></td></tr>`).join('')+'</tbody></table>':'<div class="empty">No payment records yet.</div>';document.querySelectorAll('[data-del-pay]').forEach(b=>b.onclick=async()=>{await deleteDoc(doc(db,'payments',b.dataset.delPay));await renderPayments();toast('Payment deleted.')})}

document.querySelector('#businessForm').addEventListener('submit',async e=>{e.preventDefault();await setDoc(doc(db,'managerPrivate','main'),{notes:document.querySelector('#businessNotes').value,updatedAt:serverTimestamp()},{merge:true});document.querySelector('#businessSaved').textContent='Private data saved.';toast('Private data saved.')});
async function loadBusiness(){const s=await getDoc(doc(db,'managerPrivate','main'));if(s.exists())document.querySelector('#businessNotes').value=s.data().notes||''}

// SERVICES / PROJECTS
function projectFormReset(){editingProjectId=null;document.querySelector('#projectForm').reset();document.querySelector('#projectFormTitle').textContent='Add Project';document.querySelector('#projectSaveBtn').textContent='Save Project';document.querySelector('#existingMedia').innerHTML='';document.querySelector('#projectFiles').value=''}
document.querySelector('#projectCancelBtn').onclick=projectFormReset;
document.querySelector('#projectForm').addEventListener('submit',saveProject);

async function saveProject(e){
  e.preventDefault();
  const serviceKey=document.querySelector('#projectService').value;
  const name=document.querySelector('#projectName').value.trim();
  const description=document.querySelector('#projectDescription').value.trim();
  if(!serviceKey||!name)return alert('Select service and enter project name.');
  const wasEditing=Boolean(editingProjectId); const btn=document.querySelector('#projectSaveBtn');btn.disabled=true;btn.textContent='Saving...';
  try{
    let projectId=editingProjectId;
    let oldMedia=[];
    if(projectId){const old=await getDoc(doc(db,'projects',projectId));if(old.exists())oldMedia=old.data().media||[];}
    else {const created=await addDoc(collection(db,'projects'),{serviceKey,name,description,media:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});projectId=created.id;}
    const files=[...document.querySelector('#projectFiles').files];
    const newMedia=[];
    for(let i=0;i<files.length;i++){
      const file=files[i];
      if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))continue;
      const path=`services/${serviceKey}/${projectId}/${Date.now()}_${i}_${safeFileName(file.name)}`;
      const storageRef=ref(storage,path);await uploadBytes(storageRef,file);const url=await getDownloadURL(storageRef);
      newMedia.push({url,path,type:file.type.startsWith('video/')?'video':'image',name:file.name});
    }
    await updateDoc(doc(db,'projects',projectId),{serviceKey,name,description,media:[...oldMedia,...newMedia],updatedAt:serverTimestamp()});
    projectFormReset();await renderProjects();toast(wasEditing?'Project updated.':'Project added.');
  }catch(err){console.error(err);toast('Could not save project. Check Firebase Storage setup.',false)}
  finally{btn.disabled=false;btn.textContent='Save Project'}
}

async function renderProjects(){
  const snap=await getDocs(collection(db,'projects'));let projects=[];snap.forEach(d=>projects.push({id:d.id,...d.data()}));
  projects.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const el=document.querySelector('#projectsList');
  el.innerHTML=SERVICE_LIST.map(s=>{
    const list=projects.filter(p=>p.serviceKey===s.key);
    return `<div class="service-manager-block"><div class="service-manager-head"><div><span>${s.number}</span><h3>${s.name}</h3></div><button class="small-btn" data-add-service="${s.key}">+ Add Project</button></div>${list.length?'<div class="project-manager-grid">'+list.map(projectCard).join('')+'</div>':'<div class="empty">No projects in this service yet. Click “Add Project”.</div>'}</div>`;
  }).join('');
  el.querySelectorAll('[data-add-service]').forEach(b=>b.onclick=()=>{document.querySelector('#projectService').value=b.dataset.addService;document.querySelector('#projectFormTitle').textContent='Add Project';document.querySelector('#projectSaveBtn').textContent='Save Project';document.querySelector('#projectForm').scrollIntoView({behavior:'smooth',block:'start'})});
  el.querySelectorAll('[data-edit-project]').forEach(b=>b.onclick=()=>editProject(b.dataset.editProject));
  el.querySelectorAll('[data-del-project]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.delProject));
}
function projectCard(p){const media=p.media||[];const first=media.find(x=>x.type==='image')||media[0];return `<article class="project-admin-card">${first?`<div class="project-thumb">${first.type==='video'?`<video src="${first.url}" muted controls></video>`:`<img src="${first.url}" alt="${escapeHtml(p.name)}">`}</div>`:'<div class="project-thumb no-media">No media</div>'}<div class="project-admin-body"><h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.description||'')}</p><small>${media.length} media file${media.length===1?'':'s'}</small><div class="actions-row"><button data-edit-project="${p.id}">Edit</button><button class="danger" data-del-project="${p.id}">Delete</button></div></div></article>`}
async function editProject(id){const s=await getDoc(doc(db,'projects',id));if(!s.exists())return;const p=s.data();editingProjectId=id;document.querySelector('#projectFormTitle').textContent='Edit Project';document.querySelector('#projectSaveBtn').textContent='Update Project';document.querySelector('#projectService').value=p.serviceKey;document.querySelector('#projectName').value=p.name||'';document.querySelector('#projectDescription').value=p.description||'';document.querySelector('#projectFiles').value='';document.querySelector('#existingMedia').innerHTML=(p.media||[]).length?`<p class="mini-label">Existing media (new uploads will be added):</p>`+(p.media||[]).map((m,i)=>`<div class="existing-media"><span>${m.type==='video'?'🎥':'📷'} ${escapeHtml(m.name||('Media '+(i+1)))}</span><button type="button" data-remove-media="${i}" data-project="${id}">Remove</button></div>`).join(''):'<p class="mini-label">No existing media.</p>';document.querySelector('#projectForm').scrollIntoView({behavior:'smooth',block:'start');document.querySelectorAll('[data-remove-media]').forEach(b=>b.onclick=()=>removeProjectMedia(b.dataset.project,Number(b.dataset.removeMedia)))}
async function removeProjectMedia(projectId,index){const s=await getDoc(doc(db,'projects',projectId));if(!s.exists())return;const media=s.data().media||[];const item=media[index];if(!item)return;if(!confirm('Remove this media from the project?'))return;try{if(item.path)await deleteObject(ref(storage,item.path)).catch(()=>{});media.splice(index,1);await updateDoc(doc(db,'projects',projectId),{media,updatedAt:serverTimestamp()});await editProject(projectId);await renderProjects();toast('Media removed.')}catch(e){toast('Could not remove media.',false)}}
async function deleteProject(id){const s=await getDoc(doc(db,'projects',id));if(!s.exists())return;if(!confirm('Delete this project and all its photos/videos?'))return;try{for(const m of s.data().media||[]){if(m.path)await deleteObject(ref(storage,m.path)).catch(()=>{})}await deleteDoc(doc(db,'projects',id));if(editingProjectId===id)projectFormReset();await renderProjects();toast('Project deleted.')}catch(e){console.error(e);toast('Could not delete project.',false)}}

// GALLERY
let editingGalleryId=null;
document.querySelector('#galleryForm').addEventListener('submit',saveGallery);
document.querySelector('#galleryCancelBtn').onclick=galleryFormReset;
function galleryFormReset(){editingGalleryId=null;document.querySelector('#galleryForm').reset();document.querySelector('#galleryFormTitle').textContent='Add Gallery Media';document.querySelector('#gallerySaveBtn').textContent='Save to Gallery';document.querySelector('#galleryExisting').innerHTML='';}
async function saveGallery(e){
  e.preventDefault();const title=document.querySelector('#galleryTitle').value.trim();const description=document.querySelector('#galleryDescription').value.trim();const files=[...document.querySelector('#galleryFiles').files];
  if(!title&&!files.length)return alert('Enter a title or choose a photo/video.');
  const wasEditing=Boolean(editingGalleryId); const btn=document.querySelector('#gallerySaveBtn');btn.disabled=true;btn.textContent='Uploading...';
  try{
    let id=editingGalleryId, media=[];
    if(id){const s=await getDoc(doc(db,'gallery',id));if(s.exists())media=s.data().media||[];}
    else {const created=await addDoc(collection(db,'gallery'),{title,description,media:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});id=created.id;}
    for(let i=0;i<files.length;i++){const file=files[i];if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))continue;const path=`gallery/${id}/${Date.now()}_${i}_${safeFileName(file.name)}`;const sr=ref(storage,path);await uploadBytes(sr,file);const url=await getDownloadURL(sr);media.push({url,path,type:file.type.startsWith('video/')?'video':'image',name:file.name});}
    await updateDoc(doc(db,'gallery',id),{title,description,media,updatedAt:serverTimestamp()});galleryFormReset();await renderGallery();toast(wasEditing?'Gallery updated.':'Added to gallery.');
  }catch(err){console.error(err);toast('Could not save gallery item. Check Firebase Storage setup.',false)}finally{btn.disabled=false;btn.textContent='Save to Gallery'}
}
async function renderGallery(){const snap=await getDocs(collection(db,'gallery'));let rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));rows.sort((a,b)=>String(b.createdAt?.seconds||0).localeCompare(String(a.createdAt?.seconds||0)));const el=document.querySelector('#galleryList');el.innerHTML=rows.length?'<div class="gallery-admin-grid">'+rows.map(galleryCard).join('')+'</div>':'<div class="empty">No gallery media added yet.</div>';el.querySelectorAll('[data-edit-gallery]').forEach(b=>b.onclick=()=>editGallery(b.dataset.editGallery));el.querySelectorAll('[data-del-gallery]').forEach(b=>b.onclick=()=>deleteGallery(b.dataset.delGallery))}
function galleryCard(g){const media=g.media||[];const first=media[0];return `<article class="project-admin-card">${first?`<div class="project-thumb">${first.type==='video'?`<video src="${first.url}" muted controls></video>`:`<img src="${first.url}" alt="${escapeHtml(g.title||'Gallery')}">`}</div>`:'<div class="project-thumb no-media">No media</div>'}<div class="project-admin-body"><h4>${escapeHtml(g.title||'Untitled')}</h4><p>${escapeHtml(g.description||'')}</p><small>${media.length} media file${media.length===1?'':'s'}</small><div class="actions-row"><button data-edit-gallery="${g.id}">Edit</button><button class="danger" data-del-gallery="${g.id}">Delete</button></div></div></article>`}
async function editGallery(id){const s=await getDoc(doc(db,'gallery',id));if(!s.exists())return;const g=s.data();editingGalleryId=id;document.querySelector('#galleryFormTitle').textContent='Edit Gallery Item';document.querySelector('#gallerySaveBtn').textContent='Update Gallery';document.querySelector('#galleryTitle').value=g.title||'';document.querySelector('#galleryDescription').value=g.description||'';document.querySelector('#galleryFiles').value='';document.querySelector('#galleryExisting').innerHTML=(g.media||[]).length?`<p class="mini-label">Existing media (new uploads will be added):</p>`+(g.media||[]).map((m,i)=>`<div class="existing-media"><span>${m.type==='video'?'🎥':'📷'} ${escapeHtml(m.name||('Media '+(i+1)))}</span><button type="button" data-remove-gallery-media="${i}" data-gallery="${id}">Remove</button></div>`).join(''):'<p class="mini-label">No existing media.</p>';document.querySelector('#galleryForm').scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('[data-remove-gallery-media]').forEach(b=>b.onclick=()=>removeGalleryMedia(b.dataset.gallery,Number(b.dataset.removeGalleryMedia)))}
async function removeGalleryMedia(id,index){const s=await getDoc(doc(db,'gallery',id));if(!s.exists())return;const media=s.data().media||[];const item=media[index];if(!item||!confirm('Remove this media?'))return;try{if(item.path)await deleteObject(ref(storage,item.path)).catch(()=>{});media.splice(index,1);await updateDoc(doc(db,'gallery',id),{media,updatedAt:serverTimestamp()});await editGallery(id);await renderGallery();toast('Gallery media removed.')}catch(e){toast('Could not remove media.',false)}}
async function deleteGallery(id){const s=await getDoc(doc(db,'gallery',id));if(!s.exists())return;if(!confirm('Delete this gallery item and all its photos/videos?'))return;try{for(const m of s.data().media||[]){if(m.path)await deleteObject(ref(storage,m.path)).catch(()=>{})}await deleteDoc(doc(db,'gallery',id));if(editingGalleryId===id)galleryFormReset();await renderGallery();toast('Gallery item deleted.')}catch(e){toast('Could not delete gallery item.',false)}}
