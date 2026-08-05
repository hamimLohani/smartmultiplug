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
