/**
 * Network connectivity status using @react-native-community/netinfo.
 *
 * Provides a synchronous isOnline() check and a subscription for
 * online/offline transition callbacks (used by the sync engine).
 */

import NetInfo from '@react-native-community/netinfo';

let _isOnline = true;

/**
 * Subscribe to network status changes.
 * Calls onOnline when the device transitions from offline to online,
 * and onOffline when transitioning from online to offline.
 *
 * @returns Unsubscribe function
 */
export function subscribeToNetworkStatus(
  onOnline: () => void,
  onOffline: () => void,
): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const wasOnline = _isOnline;
    _isOnline = state.isConnected ?? false;

    if (_isOnline && !wasOnline) onOnline();
    if (!_isOnline && wasOnline) onOffline();
  });

  return unsubscribe;
}

/**
 * Returns the current cached online status.
 * Updated reactively via the NetInfo listener.
 */
export function isOnline(): boolean {
  return _isOnline;
}
