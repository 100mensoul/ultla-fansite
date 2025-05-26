// profile-manager.js（ユーザープロフィール管理）
import { db } from './firebase-test.js';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * ユーザープロフィールを取得
 * @param {string} uid - ユーザーUID
 * @returns {Object|null} プロフィール情報
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  
  try {
    const profileRef = doc(db, "userProfiles", uid);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      return profileSnap.data();
    } else {
      console.log("ユーザープロフィールが見つかりません:", uid);
      return null;
    }
  } catch (error) {
    console.error("プロフィール取得エラー:", error);
    return null;
  }
}

/**
 * ユーザープロフィールを作成/更新
 * @param {string} uid - ユーザーUID
 * @param {string} username - ユーザーネーム
 * @param {string} displayName - 表示名（オプション）
 * @returns {boolean} 成功/失敗
 */
export async function updateUserProfile(uid, username, displayName = '') {
  if (!uid || !username) {
    console.error("UID またはユーザーネームが不正です");
    return false;
  }
  
  try {
    const profileRef = doc(db, "userProfiles", uid);
    const profileData = {
      uid,
      username: username.trim(),
      displayName: displayName.trim() || username.trim(),
      updatedAt: serverTimestamp()
    };
    
    // 新規作成の場合は createdAt も追加
    const existingProfile = await getDoc(profileRef);
    if (!existingProfile.exists()) {
      profileData.createdAt = serverTimestamp();
    }
    
    await setDoc(profileRef, profileData, { merge: true });
    console.log("プロフィール更新成功:", profileData);
    return true;
  } catch (error) {
    console.error("プロフィール更新エラー:", error);
    return false;
  }
}

/**
 * ユーザーネームの重複チェック
 * @param {string} username - チェックするユーザーネーム
 * @param {string} currentUid - 現在のユーザーUID（自分の場合は除外）
 * @returns {boolean} 重複しているかどうか
 */
export async function checkUsernameExists(username, currentUid = null) {
  if (!username) return false;
  
  try {
    const profilesRef = collection(db, "userProfiles");
    const querySnapshot = await getDocs(
      query(profilesRef, where("username", "==", username.trim()))
    );
    
    // 自分以外のユーザーで同じユーザーネームがあるかチェック
    const duplicateUsers = querySnapshot.docs.filter(doc => 
      currentUid ? doc.id !== currentUid : true
    );
    
    return duplicateUsers.length > 0;
  } catch (error) {
    console.error("ユーザーネーム重複チェックエラー:", error);
    return false; // エラーの場合は重複なしとして処理
  }
}

/**
 * 表示名を取得（ユーザーネーム設定済みの場合）
 * @param {string} uid - ユーザーUID
 * @returns {string} 表示名
 */
export async function getDisplayName(uid) {
  const profile = await getUserProfile(uid);
  return profile ? profile.displayName : '匿名ユーザー';
}

/**
 * プロフィール設定が完了しているかチェック
 * @param {string} uid - ユーザーUID
 * @returns {boolean} 設定完了かどうか
 */
export async function isProfileComplete(uid) {
  const profile = await getUserProfile(uid);
  return profile && profile.username && profile.username.trim() !== '';
}
