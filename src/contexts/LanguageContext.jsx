import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext(null);

const translations = {
  en: {
    // Navigation / TabBar
    tab_home: 'Home',
    tab_timers: 'Timers',
    tab_settings: 'Settings',

    // Common/General
    yes: 'Yes',
    no: 'No',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    loading: 'Loading...',
    on: 'ON',
    off: 'OFF',
    delete: 'Delete',
    unpaired: 'Unpaired',
    online: 'Online',
    offline: 'Offline',

    // Login page
    login_title: 'Smart Multi-Plug',
    login_subtitle: 'Sign in to control your device',
    login_email: 'Email',
    login_password: 'Password',
    login_forgot: 'Forgot password?',
    login_btn: 'Sign In',
    login_or: 'or',
    login_google: 'Continue with Google',
    login_no_acc: "Don't have an account?",
    login_create_acc: 'Create one',
    reset_title: 'Reset Password',
    reset_desc: "We'll send a reset link to your inbox.",
    reset_btn: 'Send Reset Link',
    reset_back: 'Back to Sign In',

    // SignUp page
    signup_subtitle: 'Create an account to get started',
    signup_name: 'Full Name',
    signup_confirm: 'Confirm Password',
    signup_btn: 'Create Account',
    signup_has_acc: 'Already have an account?',
    signup_login_link: 'Sign In',

    // Pair Device Page
    pair_title: 'Pair New Device',
    pair_desc: 'Enter your plug credentials to claim ownership.',
    pair_device_id: 'Device ID',
    pair_sec_code: 'Security Code',
    pair_btn: 'Pair Device',
    pair_notice: 'Only claim devices that you own or have permission to manage.',

    // Settings Page
    settings_title: 'Settings',
    settings_subtitle: 'Manage your profile and device configurations',
    settings_account: 'Account Settings',
    settings_logged_in: 'Logged in as',
    settings_change_pw: 'Change Password',
    settings_unpair_title: 'Unpair Device',
    settings_unpair_desc: 'Remove this plug from your account',
    settings_logout: 'Sign Out',
    settings_rename_header: 'Rename Outlets',
    settings_rename_btn: 'Rename',
    settings_new_pw: 'New Password',
    settings_confirm_pw: 'Confirm New Password',
    settings_confirm_unpair_title: 'Unpair Multi-Plug?',
    settings_confirm_unpair_body: 'Are you sure you want to remove this multi-plug from your account? You will have to pair it again to control it.',
    settings_confirm_logout_title: 'Sign Out',
    settings_confirm_logout_body: 'Are you sure you want to sign out of your account?',

    // Help & Instructions
    settings_help_title: 'Help & Instructions',
    settings_help_subtitle: 'How to Setup & Use',
    settings_help_intro: 'Follow the steps below to set up your Smart Multi-Plug for the first time:',
    settings_help_step1_title: 'Power On (Power On)',
    settings_help_step1_desc: 'Plug the multi-plug into a wall socket. The plug display or indicator light will turn on.',
    settings_help_step2_title: 'Navigate Screen',
    settings_help_step2_desc: 'View the on/off status and network status on the display. Use the 3 buttons (Up/Down/OK) below the display to navigate the screen menu.',
    settings_help_step3_title: 'Connect to Plug WiFi (Plug WiFi)',
    settings_help_step3_desc: 'Turn on your phone\'s WiFi. You will see a new WiFi named "SP4-XXXX" (or SP2/SP3). Tap to connect (no password needed).',
    settings_help_step4_title: 'Connect to Home WiFi (Setup Internet)',
    settings_help_step4_desc: 'After connecting to the plug\'s WiFi, a setup page will open automatically on your phone. If it doesn\'t, go to "192.168.4.1" in your browser. Select your home WiFi, enter the password, and tap "Save". The plug will connect to the internet.',
    settings_help_step5_title: 'Get Security Code (Security Code)',
    settings_help_step5_desc: 'On display model: Press the plug button, go to Menu → App Connect. You will see "Device ID" and "Security Code" (8-digit code). Without display: The code is printed on the back of the plug or on a sticker.',
    settings_help_step6_title: 'Connect Plug to Account (App Connect)',
    settings_help_step6_desc: 'Login or create a new account from the right side form on this website. After logging in, go to the Pair Device page and submit the plug ID and security code.',
    settings_help_step7_title: 'Control Plug via App (App Control)',
    settings_help_step7_desc: 'Once connected, you can turn each outlet on/off from the Dashboard. You can also go to Timers & Schedule to set auto-off or schedules for outlets.',
    settings_download_manual: 'Download User Manual (Bangla PDF)',

    // Timers Page
    timers_title: 'Advanced Timers',
    timers_subtitle: 'Automate your outlets with delays or schedules.',
    timers_delay: '⏱ Delay',
    timers_schedule: '📅 Schedule',
    timers_outlet: 'Outlet',
    timers_action: 'Action',
    timers_turn_on: '⚡ Turn On',
    timers_turn_off: '○ Turn Off',
    timers_delay_duration: 'Delay Duration',
    timers_custom_min: 'Custom minutes',
    timers_time: 'Time',
    timers_repeat: 'Repeat',
    timers_once: 'Once',
    timers_everyday: 'Every Day',
    timers_custom_days: 'Custom…',
    timers_add_btn: '+ Add Timer',
    timers_active_timers: 'Active Timers',
    timers_no_active: 'No active timers',
    timers_disabled_title: 'Schedules Disabled',
    timers_disabled_desc: 'Please pair a device first to set automated on/off schedules and delay timers.',
    timers_wifi_warning: 'WiFi not connected — connect your plug to enable schedules.',
    timers_wifi_ok: 'WiFi connected — schedule will sync to device.',

    // Dashboard Page
    dash_title: 'Dashboard',
    dash_stats_on: 'Outlets ON',
    dash_stats_timers: 'Active Timers',
    dash_online: 'Plug is online',
    dash_offline: 'Plug is offline',
    dash_paired: 'No device paired',
    dash_paired_desc: 'Pair a device to control outlets and view stats.',
    dash_btn_pair: 'Pair Device',

    // PWA Installation Recommendation
    pwa_install_title: 'Install Smart Multi-Plug App',
    pwa_install_subtitle: 'Get instant home screen access, faster load times & fullscreen experience.',
    pwa_install_btn: 'Install App',
    pwa_install_later: 'Not Now',
    pwa_badge: 'App Recommended',
    pwa_feature_1_title: '1-Tap Fast Access',
    pwa_feature_1_desc: 'Launch directly from your phone home screen or desktop.',
    pwa_feature_2_title: 'Fullscreen & Offline Ready',
    pwa_feature_2_desc: 'Smoother control and reliable operation even on weak network.',
    pwa_ios_guide_title: 'How to install on iPhone / iPad (iOS):',
    pwa_ios_step_1: '1. Tap the Share button ( 📤 ) in Safari toolbar',
    pwa_ios_step_2: '2. Scroll down & select "Add to Home Screen" ( ➕ )',
    pwa_ios_step_3: '3. Tap "Add" in the top right corner',
    pwa_generic_guide_title: 'How to install from Browser:',
    pwa_generic_step_1: '1. Open browser menu ( ⋮ or ⚙️ )',
    pwa_generic_step_2: '2. Select "Install App" or "Add to Home Screen"',
    pwa_got_it: 'Got It!',
    pwa_installed_badge: 'PWA Installed',
    pwa_settings_card_title: 'Mobile App & PWA',
    pwa_settings_card_desc: 'Install the app to your Home Screen for instant 1-tap remote control without using browser address bar.',
  },
  bn: {
    // Navigation / TabBar
    tab_home: 'হোম',
    tab_timers: 'টাইমার ও শিডিউল',
    tab_settings: 'সেটিংস',

    // Common/General
    yes: 'হ্যাঁ',
    no: 'না',
    cancel: 'বাতিল',
    confirm: 'নিশ্চিত করুন',
    save: 'সেভ করুন',
    loading: 'অপেক্ষা করুন...',
    on: 'চালু (ON)',
    off: 'বন্ধ (OFF)',
    delete: 'মুছে ফেলুন',
    unpaired: 'সংযুক্ত নয়',
    online: 'অনলাইন',
    offline: 'অফলাইন',

    // Login page
    login_title: 'স্মার্ট মাল্টি-প্লাগ',
    login_subtitle: 'প্লাগ নিয়ন্ত্রণ করতে লগইন করুন',
    login_email: 'ইমেইল অ্যাড্রেস',
    login_password: 'পাসওয়ার্ড',
    login_forgot: 'পাসওয়ার্ড ভুলে গেছেন?',
    login_btn: 'লগইন করুন',
    login_or: 'অথবা',
    login_google: 'গুগল দিয়ে লগইন করুন',
    login_no_acc: 'অ্যাকাউন্ট নেই?',
    login_create_acc: 'নতুন অ্যাকাউন্ট খুলুন',
    reset_title: 'পাসওয়ার্ড পরিবর্তন করুন',
    reset_desc: 'আমরা আপনার ইমেইলে একটি লিংক পাঠাবো।',
    reset_btn: 'লিংক পাঠান',
    reset_back: 'লগইন পেজে ফিরুন',

    // SignUp page
    signup_subtitle: 'শুরু করতে একটি অ্যাকাউন্ট তৈরি করুন',
    signup_name: 'পূর্ণ নাম (Full Name)',
    signup_confirm: 'পাসওয়ার্ড নিশ্চিত করুন',
    signup_btn: 'অ্যাকাউন্ট তৈরি করুন',
    signup_has_acc: 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
    signup_login_link: 'লগইন করুন',

    // Pair Device Page
    pair_title: 'প্লাগ কানেক্ট করুন',
    pair_desc: 'সঠিক তথ্য দিয়ে আপনার মাল্টি-প্লাগটি যুক্ত করুন।',
    pair_device_id: 'ডিভাইস আইডি (Device ID)',
    pair_sec_code: 'সিকিউরিটি কোড (Security Code)',
    pair_btn: 'কানেক্ট করুন',
    pair_notice: 'শুধুমাত্র নিজের অথবা অনুমতি আছে এমন প্লাগ কানেক্ট করুন।',

    // Settings Page
    settings_title: 'সেটিংস',
    settings_subtitle: 'অ্যাকাউন্ট ও ডিভাইস সেটিংস পরিবর্তন করুন',
    settings_account: 'অ্যাকাউন্ট সেটিংস',
    settings_logged_in: 'লগইন করা আইডি',
    settings_change_pw: 'পাসওয়ার্ড পরিবর্তন',
    settings_unpair_title: 'প্লাগ রিমুভ করুন',
    settings_unpair_desc: 'অ্যাকাউন্ট থেকে এই প্লাগটি মুছে ফেলুন',
    settings_logout: 'লগ আউট করুন',
    settings_rename_header: 'সকেটের নাম পরিবর্তন করুন',
    settings_rename_btn: 'নাম পরিবর্তন',
    settings_new_pw: 'নতুন পাসওয়ার্ড',
    settings_confirm_pw: 'নতুন পাসওয়ার্ড নিশ্চিত করুন',
    settings_confirm_unpair_title: 'প্লাগ রিমুভ করবেন?',
    settings_confirm_unpair_body: 'আপনি কি নিশ্চিত যে আপনার অ্যাকাউন্ট থেকে এই মাল্টি-প্লাগটি রিমুভ করতে চান? রিমুভ করলে এটি আবার নতুন কোড দিয়ে কানেক্ট করতে হবে।',
    settings_confirm_logout_title: 'লগ আউট',
    settings_confirm_logout_body: 'আপনি কি নিশ্চিত যে অ্যাকাউন্ট থেকে লগ আউট করতে চান?',

    // Help & Instructions
    settings_help_title: 'সাহায্য ও নির্দেশিকা',
    settings_help_subtitle: 'কিভাবে সেটআপ ও ব্যবহার করবেন?',
    settings_help_intro: 'আপনার স্মার্ট মাল্টি-প্লাগটি প্রথমবার সেটআপ করার জন্য নিচের ধাপগুলো মনোযোগ দিয়ে অনুসরণ করুন:',
    settings_help_step1_title: 'পাওয়ার অন করুন (Power On)',
    settings_help_step1_desc: 'মাল্টি-প্লাগটির মেইন তারটি দেওয়ালের বৈদ্যুতিক সকেটে লাগান। প্লাগের ডিসপ্লে অথবা ইন্ডিকেটর লাল লাইটটি জ্বলে উঠবে।',
    settings_help_step2_title: 'মেনু ও ডিসপ্লে (Navigate Screen)',
    settings_help_step2_desc: 'ডিসপ্লে স্ক্রিনে আপনার মাল্টি-প্লাগের অন/অফ অবস্থা এবং নেটওয়ার্ক স্ট্যাটাস দেখতে পাবেন। ডিসপ্লের নিচে ৩টি বোতাম (Up/Down/OK) চেপে স্ক্রিন মেনুতে যেরাযুরি করতে পারবেন।',
    settings_help_step3_title: 'প্লাগের নিজস্ব ওয়াইফাই কানেক্ট করুন (Plug WiFi)',
    settings_help_step3_desc: 'আপনার মোবাইল ফোনের WiFi চালু করুন। সেখানে "SP4-XXXX" (অথবা SP2/SP3) নামের একটি নতুন ওয়াইফাই দেখতে পাবেন। এটিতে ক্লিক করে কানেক্ট করুন (কোনো পাসওয়ার্ড লাগবে না)।',
    settings_help_step4_title: 'বাসার ওয়াইফাইয়ের সাথে প্লাগ কানেক্ট করুন (Setup Internet)',
    settings_help_step4_desc: 'প্লাগের ওয়াইফাই কানেক্ট করার পর আপনার মোবাইলে অটোমেটিক একটি সেটআপ পেজ খুলবে। পেজটি না আসলে ব্রাউজারে "192.168.4.1" লিখে গো (Go) চাপুন। সেখানে আপনার বাসার ওয়াইফাই সিলেক্ট করে পাসওয়ার্ড দিন এবং "Save" বাটনে ক্লিক করুন। প্লাগটি আপনার বাসার ইন্টারনেটে কানেক্ট হয়ে যাবে।',
    settings_help_step5_title: 'সিকিউরিটি কোড সংগ্রহ করুন (Security Code)',
    settings_help_step5_desc: 'ডিসপ্লে মডেলে: প্লাগের বোতাম চেপে Menu → App Connect-এ যান। সেখানে "Device ID" এবং "Security Code" (৮ সংখ্যার কোড) দেখতে পাবেন। ডিসপ্লে না থাকলে: প্লাগের বডি বা পেছনের স্টিকারে কোডটি লেখা পাবেন।',
    settings_help_step6_title: 'অ্যাকাউন্টে প্লাগ কানেক্ট করুন (App Connect)',
    settings_help_step6_desc: 'ডানপাশের ফর্ম থেকে এই ওয়েবসাইটে লগইন বা নতুন অ্যাকাউন্ট খুলুন। লগইন করার পর প্লাগ কানেক্ট (Pair) করার পেজে গিয়ে প্লাগের আইডি (ID) এবং সিকিউরিটি কোডটি বিসেয় সাবমিট করুন।',
    settings_help_step7_title: 'মোবাইল দিয়ে প্লাগ নিয়ন্ত্রণ করুন (App Control)',
    settings_help_step7_desc: 'প্লাগ কানেক্ট হয়ে গেলে ড্যাশবোর্ড থেকে প্রতিটি সকেট অন/অফ করতে পারবেন। এছাড়া টাইমার ও শিডিউল অপশনে গিয়ে সকেটগুলোর জন্য অটো-অফ বা সময়সূচী সেট করতে পারবেন।',
    settings_download_manual: 'ইউজার ম্যানুয়াল ডাউনলোড করুন (বাংলা PDF)',

    // Timers Page
    timers_title: 'টাইমার ও শিডিউল',
    timers_subtitle: 'টাইমার সেট করে অটোমেটিক সকেট অন/অফ করুন।',
    timers_delay: '⏱ অটো-অফ (Delay)',
    timers_schedule: '📅 শিডিউল (Schedule)',
    timers_outlet: 'সকেট নির্বাচন করুন',
    timers_action: 'অন নাকি অফ?',
    timers_turn_on: '⚡ চালু (ON) করুন',
    timers_turn_off: '○ বন্ধ (OFF) করুন',
    timers_delay_duration: 'কতক্ষণ পর বন্ধ/চালু হবে?',
    timers_custom_min: 'মিনিট লিখুন',
    timers_time: 'কখন চালু/বন্ধ হবে?',
    timers_repeat: 'দিন নির্বাচন (পুনরাবৃত্তি)',
    timers_once: 'শুধু একবার',
    timers_everyday: 'প্রতিদিন',
    timers_custom_days: 'কাস্টম দিন…',
    timers_add_btn: '+ অটো-অফ বা শিডিউল যোগ করুন',
    timers_active_timers: 'চলমান টাইমার ও শিডিউল',
    timers_no_active: 'কোনো টাইমার বা শিডিউল চালু নেই',
    timers_disabled_title: 'টাইমার সুবিধা বন্ধ',
    timers_disabled_desc: 'সকেটের জন্য অটো অন/অফ বা টাইমার সেট করতে প্রথমে একটি মাল্টি-প্লাগ কানেক্ট করুন।',
    timers_wifi_warning: 'প্লাগটি ইন্টারনেট বা ওয়াইফাইয়ের সাথে কানেক্টেড নেই। দয়া করে কানেক্ট করুন।',
    timers_wifi_ok: 'প্লাগটি ইন্টারনেটে কানেক্টেড আছে — শিডিউল অটোমেটিক কাজ করবে।',

    // Dashboard Page
    dash_title: 'ড্যাশবোর্ড',
    dash_stats_on: 'চালু আছে (ON)',
    dash_stats_timers: 'চলমান টাইমার',
    dash_online: 'প্লাগটি চালু (অনলাইন) আছে',
    dash_offline: 'প্লাগটি বন্ধ (অফলাইন) আছে',
    dash_paired: 'কোনো প্লাগ কানেক্ট করা নেই',
    dash_paired_desc: 'সকেট অন/অফ এবং টাইমার সেট করতে প্রথমে আপনার মাল্টি-প্লাগটি কানেক্ট করুন।',
    dash_btn_pair: 'মাল্টি-প্লাগ কানেক্ট করুন',

    // PWA Installation Recommendation
    pwa_install_title: 'স্মার্ট মাল্টি-প্লাগ অ্যাপ ইনস্টল করুন',
    pwa_install_subtitle: 'হোম স্ক্রিন থেকে ১-ক্লিকে সরাসরি অ্যাপের মতো ব্যবহার করুন ও দ্রত নিয়ন্ত্রণ করুন।',
    pwa_install_btn: 'ইনস্টল করুন',
    pwa_install_later: 'পরে করব',
    pwa_badge: 'ইনস্টল করার সুপারিশ',
    pwa_feature_1_title: '১-ক্লিকে দ্রুত ওপেন',
    pwa_feature_1_desc: 'মোবাইলের হোম স্ক্রিন বা ডেসটপ থেকে ব্রাউজার ছাড়াই সরাসরি অ্যাপ খুলুন',
    pwa_feature_2_title: 'ফুলস্ক্রিন ও ফাস্ট পারফর্মেন্স',
    pwa_feature_2_desc: 'কোনো এড্রেস বার ছাড়া পুরো স্ক্রিন জুড়ে স্মুথ ও স্বাচ্ছন্দ্যে ব্যবহার করুন',
    pwa_ios_guide_title: 'আইফোনে (iOS) কীভাবে ইনস্টল করবেন:',
    pwa_ios_step_1: '১. সাফারির নিচে শেয়ার (Share 📤) বাটনে ট্যাপ করুন',
    pwa_ios_step_2: '২. নিচে স্ক্রোল করে "Add to Home Screen" ( ➕ ) নির্বাচন করুন',
    pwa_ios_step_3: '৩. উপরে ডানপাশে "Add" বাটনে ক্লিক করুন',
    pwa_generic_guide_title: 'ব্রাউজারে কীভাবে ইনস্টল করবেন:',
    pwa_generic_step_1: '১. আপনার ব্রাউজারের থ্রি-ডট ( ⋮ ) মেনুতে যান',
    pwa_generic_step_2: '২. "Install App" বা "Add to Home Screen" অপশনে ক্লিক করুন',
    pwa_got_it: 'বুঝতে পেরেছি',
    pwa_installed_badge: 'অ্যাপ ইনস্টলড আছে',
    pwa_settings_card_title: 'মোবাইল অ্যাপ ও PWA',
    pwa_settings_card_desc: 'হোম স্ক্রিনে আইকন যোগ করে ব্রাউজার ছাড়াই অ্যাপের মতো সহজেই মাল্টি-প্লাগ নিয়ন্ত্রণ করুন।',
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('lang') || 'bn'; // default to Bangla
  });

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
