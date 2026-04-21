import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  doc,
  getDoc,
  setDoc, 
  serverTimestamp, 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential, 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);  

const $googleLogin = document.querySelector('#google-login');
const $fbLogin = document.querySelector('#facebook-login');
const $signupLoginToggle = document.querySelector('.signup-login-toggle');
const $signupLoginIdentifiers = document.querySelectorAll('[data-ak="signup-login-identifier"]');
const $username = document.querySelector('#Username');
const $email = document.querySelector('#Email-Address');
const $password = document.querySelector('#Password'); 
const $signupLoginBtn = document.querySelector('#signup-login-btn');

const signupLoginToggleText = $signupLoginToggle.textContent.trim();
const signupLoginToggleTextIncludesLogin = signupLoginToggleText.toLowerCase().includes('login'); 

localStorage['ak-is-login'] = signupLoginToggleTextIncludesLogin ? false : true;  

$googleLogin.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    console.log(result.user);
    
    await handleRedirect();
  } 
  catch (err) {
    handleError(err);
  }
});

$fbLogin.addEventListener('click', async () => {
  try {
    const provider = new FacebookAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user exists in Firestore
    /*const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Create user profile
      let { name:displayName, email } = user; 
      if (name === undefined) name = email.split('@')[0];
      await setDoc(userRef, {
        email,
        name,
        provider: 'facebook',
        createdAt: serverTimestamp(), 
      });
    }*/

    await handleRedirect(); 
  } 
  catch (err) {
    if (err.code === 'auth/account-exists-with-different-credential') {
      const email = err.customData.email;
      const pendingCred = FacebookAuthProvider.credentialFromError(err);

      await handleAccountLinking(email, pendingCred);
    } 
    else {
      handleError(err);
    }
  }
});
  
$signupLoginBtn.addEventListener('click', async e => {
  e.preventDefault();

  const btnText = $signupLoginBtn.value.trim();
  const username = $username.value.trim();
  const email = $email.value.trim();
  const password = $password.value.trim();
  const isLogin = localStorage['ak-is-login'];

  console.log('username:', username)
  console.log('email:', email)
  console.log('password:', password)
  console.log('isLogin:', isLogin)

  try {
    if (isLogin.includes('true')) {
      console.log('Logging in...')
      $signupLoginBtn.value = 'Logging in...';
      await signInWithEmailAndPassword(auth, email, password);
    } 
    else {
      console.log('Signing up...')
      $signupLoginBtn.value = 'Signing up...';
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // Save username
      await setDoc(doc(db, 'users', userCred.user.uid), {
        username,
        email,
        createdAt: serverTimestamp(),
      });
    }

    $signupLoginBtn.value = 'Redirecting...';
    await handleRedirect();
  } 
  catch (err) {
    handleError(err);
    $signupLoginBtn.value = btnText;
  }
});

const signupText = 'Sign Up';
const signupPrompt = 'Not registered? Sign Up';
const loginText = 'Login';
const loginPrompt = 'Already registered? Login';

$signupLoginToggle.addEventListener('click', e => {
  const $btn = e.currentTarget;
  const btnText = $btn.textContent.trim(); 
  const btnTextIncludesLogin = btnText.toLowerCase().includes('login');
  
  let toggleText = '';
  if (btnTextIncludesLogin) {
    toggleText = loginText;
    $btn.textContent = signupPrompt;
    localStorage['ak-is-login'] = true; 
  }
  else {
    toggleText = signupText;
    $btn.textContent = loginPrompt;
    localStorage['ak-is-login'] = false; 
  }
    
  $signupLoginIdentifiers.forEach(identifier => {
    identifier.textContent = toggleText;
    identifier.value = toggleText;
  });
});

async function handleRedirect() {
  localStorage['ak-logged-in'] = 'true';
  await linkPendingCredential();
  redirectUser(); 
}

function redirectUser() {
  window.location.href = '/';
}

function handleError(err) {
  console.error(err);

  let msg, message = ''; 
  const { code } = err;
  if (code) { 
	const codeArr = code.split('/');
    if (codeArr.length === 1) {
      msg = codeArr[0];
    }
    else {
      msg = code.split('/')[1]?.split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
  }

  message = msg || 'Something went wrong';  
  showError('Error!', message);
} 

async function handleAccountLinking(email, pendingCred) {
  const methods = await fetchSignInMethodsForEmail(auth, email);

  const providerMap = {
    'google.com': 'Google',
    'facebook.com': 'Facebook',
    'apple.com': 'Apple',
    'password': 'Email & Password'
  };

  // Convert methods into readable names
  const readableMethods = methods.map(method => providerMap[method] || method);
  let message = 'An account already exists with this email.\n\n';

  if (readableMethods.length === 1) {
    message += `Please sign in using ${readableMethods[0]} to continue.`;
  } 
  else {
    message += `Please sign in using one of the following methods:\n- ${readableMethods.join('\n- ')}`;
  }

  showWarning('Account Already Exists', message);

  // Store pending credential for linking after login
  window.pendingCredential = pendingCred;
}

async function linkPendingCredential() {
  if (window.pendingCredential && auth.currentUser) {
    try {
      await linkWithCredential(auth.currentUser, window.pendingCredential);
      console.log("Accounts linked successfully");

      window.pendingCredential = null;

    } catch (err) {
      console.error("Linking failed", err);
    }
  }
}
  
// SweetAlert2 Modals and Toasts 
function showModal({ title = '', text = '', icon = 'info', confirmText = 'OK', timer = null }) {
  Swal.fire({
    title,
    text,
    icon,
    confirmButtonText: confirmText,
    background: '#fff',
    color: '#333',
    confirmButtonColor: '#FF4500', // brand 
    showClass: {
      popup: 'animate__animated animate__fadeInDown'
    },
    hideClass: {
      popup: 'animate__animated animate__fadeOutUp'
    },
    timer,
    timerProgressBar: !!timer
  });
}

function showSuccess(title, message) {
  showModal({
    title,
    text: message,
    icon: 'success',
    confirmText: 'Great!'
  });
}

function showWarning(title, message) {
  showModal({
    title,
    text: message,
    icon: 'warning',
    confirmText: 'OK'
  });
}

function showError(title, message) {
  showModal({
    title,
    text: message,
    icon: 'error',
    confirmText: 'Close'
  });
}

// 💬 Toast notifications
function showToast(message, icon = 'info') {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e1e1e',
    color: '#fff',
  });
}

// 🔄 Loading Indicator
function showLoading(message = 'Checking availability...') {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
    background: '#fff',
    color: '#333',
  });
}

// ✅ Close loading state
function closeLoading() {
  Swal.close();
} 