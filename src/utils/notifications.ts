// Push Notification Utilities

// VAPID Public Key - This is safe to expose on client
const VAPID_PUBLIC_KEY = 'BFCk7RQ4XRQSLqB1SDQNYixLPrs1mYqC_KyfB9yjYIbB1ykgYel31eyPTM4zXmfPenZdmvdWi4mxt-k3fcTjUn4';

// Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  
  const permission = await Notification.requestPermission();
  return permission;
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Subscribe to push notifications
export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('Already subscribed to push');
      return subscription;
    }
    
    // Subscribe to push
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
    });
    
    console.log('Push subscription created:', subscription);
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

// Get current push subscription
export async function getPushSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Failed to get subscription:', error);
    return null;
  }
}

// Save subscription to server
export async function saveSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  try {
    const response = await fetch('/api/push-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to save subscription:', error);
    return false;
  }
}

// Remove subscription from server
export async function removeSubscriptionFromServer(): Promise<boolean> {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  try {
    const response = await fetch('/api/push-subscription', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to remove subscription:', error);
    return false;
  }
}

// Show a local notification (for when app is open)
export async function showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: '/logo.png',
    badge: '/logo.png',
    ...options
  });
}

// Initialize notifications system
export async function initializeNotifications(): Promise<{
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}> {
  const supported = isNotificationSupported();
  const permission = getNotificationPermission();
  
  if (!supported) {
    return { supported: false, permission: 'unsupported', subscribed: false };
  }
  
  // Register service worker
  await registerServiceWorker();
  
  // Check if subscribed
  const subscription = await getPushSubscription();
  
  return {
    supported,
    permission,
    subscribed: !!subscription
  };
}

// Full setup: request permission, subscribe, and save to server
export async function enableNotifications(): Promise<boolean> {
  try {
    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }
    
    // Register service worker
    await registerServiceWorker();
    
    // Subscribe to push
    const subscription = await subscribeToPush();
    if (!subscription) {
      console.log('Failed to subscribe to push');
      return false;
    }
    
    // Save to server
    const saved = await saveSubscriptionToServer(subscription);
    if (!saved) {
      console.log('Failed to save subscription to server');
      // Still return true since local notifications will work
    }
    
    return true;
  } catch (error) {
    console.error('Failed to enable notifications:', error);
    return false;
  }
}

// Disable notifications
export async function disableNotifications(): Promise<void> {
  await unsubscribeFromPush();
  await removeSubscriptionFromServer();
}
