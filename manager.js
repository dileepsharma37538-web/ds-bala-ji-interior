import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// 1) Replace this object with your Firebase Web App configuration.
// Firebase Console -> Project settings -> Your apps -> Web app -> Config.
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const loginForm = document.querySelector('#loginForm');
const loginError = document.querySelector('#loginError');

const configured = !firebaseConfig.apiKey.startsWith("PASTE_");
if (!configured) loginError.textContent = "Firebase setup required: add your Firebase Web App config in manager.js.";

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!configured) return;
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (err) {
    loginError.textContent = "Login failed. Check manager email/password.";
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) { loginView.classList.remove('hidden'); appView.classList.add('hidden'); return; }
  loginView.classList.add('hidden'); appView.classList.remove('hidden');
  document.querySelector('#managerEmail').textContent = user.email || '';
  await refreshAll();
});

document.querySelector('#logout').onclick = () => signOut(auth);
document.querySelector('#logoutMobile').onclick = () => signOut(auth);

document.querySelectorAll('aside button[data-tab]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.add('hidden'));
  document.querySelector('#'+btn.dataset.tab).classList.remove('hidden');
  document.querySelectorAll('aside button[data-tab]').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
}));

const today = new Date().toISOString().slice(0,10);
document.querySelector('#attDate').value = today;
document.querySelector('#payDate').value = today;

let workers = [];

async function refreshAll() {
  workers = [];
  const ws = await getDocs(collection(db,'workers'));
  ws.forEach(d => workers.push({id:d.id,...d.data()}));
  fillWorkerSelects(); renderWorkers();
  await renderAttendance(); await renderPayments(); await loadBusiness();
  document.querySelector('#workerCount').textContent = workers.length;
}

function fillWorkerSelects() {
  for (const id of ['attWorker','payWorker']) {
    const s=document.querySelector('#'+id);
    s.innerHTML='<option value="">Choose worker</option>'+workers.map(w=>`<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  }
}
function escapeHtml(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

document.querySelector('#workerForm').addEventListener('submit', async e => {
  e.preventDefault();
  await addDoc(collection(db,'workers'), {name:workerName.value.trim(), role:workerRole.value.trim(), phone:workerPhone.value.trim(), createdAt:serverTimestamp()});
  e.target.reset(); await refreshAll();
});

function renderWorkers(){
  const el=document.querySelector('#workersList');
  if(!workers.length){el.innerHTML='<div class="empty">No workers added yet.</div>';return;}
  el.innerHTML='<table><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th></th></tr></thead><tbody>'+workers.map(w=>`<tr><td>${escapeHtml(w.name)}</td><td>${escapeHtml(w.role||'-')}</td><td>${escapeHtml(w.phone||'-')}</td><td><button data-del-worker="${w.id}">Delete</button></td></tr>`).join('')+'</tbody></table>';
  el.querySelectorAll('[data-del-worker]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this worker?')){await deleteDoc(doc(db,'workers',b.dataset.delWorker));await refreshAll();}});
}

document.querySelector('#saveAttendance').onclick = async () => {
  if(!attWorker.value || !attDate.value)return alert('Select date and worker.');
  await addDoc(collection(db,'attendance'),{date:attDate.value,workerId:attWorker.value,status:attStatus.value,createdAt:serverTimestamp()});
  await renderAttendance();
};
async function renderAttendance(){
  const snap=await getDocs(collection(db,'attendance')); let rows=[]; let present=0;
  snap.forEach(d=>{const x={id:d.id,...d.data()}; const w=workers.find(z=>z.id===x.workerId); if(x.date===today&&x.status==='Present')present++; rows.push({...x,worker:w?.name||'Deleted worker'});});
  rows.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  document.querySelector('#presentCount').textContent=present;
  document.querySelector('#attendanceList').innerHTML=rows.length?'<table><thead><tr><th>Date</th><th>Worker</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${x.date}</td><td>${escapeHtml(x.worker)}</td><td>${escapeHtml(x.status)}</td><td><button data-del-att="${x.id}">Delete</button></td></tr>`).join('')+'</tbody></table>':'<div class="empty">No attendance records yet.</div>';
  document.querySelectorAll('[data-del-att]').forEach(b=>b.onclick=async()=>{await deleteDoc(doc(db,'attendance',b.dataset.delAtt));await renderAttendance();});
}

document.querySelector('#savePayment').onclick = async () => {
  if(!payWorker.value || !payDate.value || !payAmount.value)return alert('Select worker, date and amount.');
  await addDoc(collection(db,'payments'),{date:payDate.value,workerId:payWorker.value,amount:Number(payAmount.value),note:payNote.value.trim(),createdAt:serverTimestamp()});
  payAmount.value='';payNote.value='';await renderPayments();
};
async function renderPayments(){
  const snap=await getDocs(collection(db,'payments')); let rows=[],total=0;
  snap.forEach(d=>{const x={id:d.id,...d.data()};const w=workers.find(z=>z.id===x.workerId);total+=Number(x.amount||0);rows.push({...x,worker:w?.name||'Deleted worker'});});
  rows.sort((a,b)=>(b.date||'').localeCompare(a.date||'')); document.querySelector('#paymentCount').textContent=rows.length; document.querySelector('#paidTotal').textContent='₹'+total.toLocaleString('en-IN');
  document.querySelector('#paymentsList').innerHTML=rows.length?'<table><thead><tr><th>Date</th><th>Worker</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${x.date}</td><td>${escapeHtml(x.worker)}</td><td>₹${Number(x.amount||0).toLocaleString('en-IN')}</td><td>${escapeHtml(x.note||'-')}</td><td><button data-del-pay="${x.id}">Delete</button></td></tr>`).join('')+'</tbody></table>':'<div class="empty">No payment records yet.</div>';
  document.querySelectorAll('[data-del-pay]').forEach(b=>b.onclick=async()=>{await deleteDoc(doc(db,'payments',b.dataset.delPay));await renderPayments();});
}

document.querySelector('#businessForm').addEventListener('submit',async e=>{
  e.preventDefault(); await setDoc(doc(db,'managerPrivate','main'),{notes:document.querySelector('#businessNotes').value,updatedAt:serverTimestamp()},{merge:true});document.querySelector('#businessSaved').textContent='Private data saved.';
});
async function loadBusiness(){const s=await getDoc(doc(db,'managerPrivate','main'));if(s.exists())document.querySelector('#businessNotes').value=s.data().notes||'';}

if(configured){document.querySelector('aside button[data-tab="dashboard"]').classList.add('active');}
