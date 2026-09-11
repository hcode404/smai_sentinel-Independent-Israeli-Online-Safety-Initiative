import {initializeApp} from 'firebase/app';
import {getAuth,setPersistence,browserLocalPersistence,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,GoogleAuthProvider,signInWithPopup,signOut,sendEmailVerification,sendPasswordResetEmail,updateProfile} from 'firebase/auth';

const app=initializeApp({
  apiKey:'AIzaSyBhKBHABUpTCpY88PdEjFKRnPaIFmBJqB0',
  authDomain:'smai-support.firebaseapp.com',
  projectId:'smai-support',
  storageBucket:'smai-support.firebasestorage.app',
  messagingSenderId:'528798258102',
  appId:'1:528798258102:web:4d3e60013a984dfce02717'
});
const auth=getAuth(app);
auth.languageCode='he';
const actionCodeSettings={url:'https://smai-sentinel.smai-sentinel.chatgpt.site/#/login',handleCodeInApp:false};
const ready=setPersistence(auth,browserLocalPersistence).then(()=>new Promise(resolve=>{
  const stop=onAuthStateChanged(auth,user=>{stop();resolve(user);});
}));
export const authReady=()=>ready;
export const getAuthToken=async(force=false)=>{await ready;return auth.currentUser?auth.currentUser.getIdToken(force):null;};
export const loginEmail=(email,password)=>signInWithEmailAndPassword(auth,email,password);
export async function registerEmail(email,password,name){
  const result=await createUserWithEmailAndPassword(auth,email,password);
  if(name)await updateProfile(result.user,{displayName:name});
  await sendEmailVerification(result.user,actionCodeSettings);return result;
}
export async function loginGoogle(){
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  return signInWithPopup(auth,provider);
}
export const logoutFirebase=()=>signOut(auth);
export const resetFirebasePassword=email=>sendPasswordResetEmail(auth,email,actionCodeSettings);
export const resendVerification=()=>auth.currentUser&&!auth.currentUser.emailVerified?sendEmailVerification(auth.currentUser,actionCodeSettings):Promise.resolve();
export const firebaseUser=()=>auth.currentUser;
