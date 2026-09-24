import {initializeApp} from 'firebase/app';
import {getAuth,setPersistence,browserLocalPersistence,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,GoogleAuthProvider,signInWithRedirect,signOut,updateProfile} from 'firebase/auth';

const FIREBASE_API_KEY='AIzaSyBhKBHABUpTCpY88PdEjFKRnPaIFmBJqB0';

const app=initializeApp({
  apiKey:FIREBASE_API_KEY,
  authDomain:'smai-support.firebaseapp.com',
  projectId:'smai-support',
  storageBucket:'smai-support.firebasestorage.app',
  messagingSenderId:'528798258102',
  appId:'1:528798258102:web:4d3e60013a984dfce02717'
});
const auth=getAuth(app);
auth.languageCode='he';
const ready=setPersistence(auth,browserLocalPersistence).then(()=>new Promise(resolve=>{
  const stop=onAuthStateChanged(auth,user=>{stop();resolve(user);});
}));
export const authReady=()=>ready;
export const getAuthToken=async(force=false)=>{await ready;return auth.currentUser?auth.currentUser.getIdToken(force):null;};
export const loginEmail=(email,password)=>signInWithEmailAndPassword(auth,email,password);
export async function registerEmail(email,password,name){
  const result=await createUserWithEmailAndPassword(auth,email,password);
  if(name)await updateProfile(result.user,{displayName:name});
  return result;
}
export async function loginGoogle(){
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  return signInWithRedirect(auth,provider);
}
export async function resetPassword(email){
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(FIREBASE_API_KEY)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestType:'PASSWORD_RESET',email})
  });
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    const error=new Error('לא ניתן לשלוח כרגע את הודעת האיפוס');
    error.code=`auth/${String(data?.error?.message||'request-failed').toLowerCase().replaceAll('_','-')}`;
    throw error;
  }
}
export async function requestEmailChange(newEmail){
  const idToken=await getAuthToken(true);
  if(!idToken)throw new Error('יש להתחבר מחדש כדי לשנות מייל');
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(FIREBASE_API_KEY)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestType:'VERIFY_AND_CHANGE_EMAIL',idToken,newEmail})
  });
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    const error=new Error(data?.error?.message==='EMAIL_EXISTS'?'כתובת המייל כבר משמשת חשבון אחר':'לא ניתן להתחיל כרגע את החלפת המייל');
    error.code=`auth/${String(data?.error?.message||'request-failed').toLowerCase().replaceAll('_','-')}`;
    throw error;
  }
}
export const logoutFirebase=()=>signOut(auth);
export const firebaseUser=()=>auth.currentUser;
