// We need to reset the module-level _isOnline state between tests,
// so we use jest.isolateModules or re-require.

let mockAddEventListener: jest.Mock;
let mockUnsubscribe: jest.Mock;

jest.mock('@react-native-community/netinfo', () => {
  mockUnsubscribe = jest.fn();
  mockAddEventListener = jest.fn(() => mockUnsubscribe);
  return {
    __esModule: true,
    default: {
      addEventListener: mockAddEventListener,
    },
  };
});

describe('network-status', () => {
  // Fresh import for each test to reset _isOnline
  let subscribeToNetworkStatus: typeof import('./network-status').subscribeToNetworkStatus;
  let isOnline: typeof import('./network-status').isOnline;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module to get fresh _isOnline = true
    jest.resetModules();

    // Re-setup mock after resetModules
    mockUnsubscribe = jest.fn();
    mockAddEventListener = jest.fn(() => mockUnsubscribe);
    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: {
        addEventListener: mockAddEventListener,
      },
    }));

    const mod = require('./network-status');
    subscribeToNetworkStatus = mod.subscribeToNetworkStatus;
    isOnline = mod.isOnline;
  });

  it('returns true by default for isOnline', () => {
    expect(isOnline()).toBe(true);
  });

  it('calls onOffline when transitioning from online to offline', () => {
    const onOnline = jest.fn();
    const onOffline = jest.fn();

    subscribeToNetworkStatus(onOnline, onOffline);

    // Get the callback passed to addEventListener
    const callback = mockAddEventListener.mock.calls[0][0];

    // Simulate going offline (was online by default)
    callback({ isConnected: false });

    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(onOnline).not.toHaveBeenCalled();
    expect(isOnline()).toBe(false);
  });

  it('calls onOnline when transitioning from offline to online', () => {
    const onOnline = jest.fn();
    const onOffline = jest.fn();

    subscribeToNetworkStatus(onOnline, onOffline);

    const callback = mockAddEventListener.mock.calls[0][0];

    // Go offline first
    callback({ isConnected: false });
    expect(isOnline()).toBe(false);

    // Then come back online
    callback({ isConnected: true });

    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(isOnline()).toBe(true);
  });

  it('does not call callbacks when status does not change', () => {
    const onOnline = jest.fn();
    const onOffline = jest.fn();

    subscribeToNetworkStatus(onOnline, onOffline);

    const callback = mockAddEventListener.mock.calls[0][0];

    // Already online, fire online again
    callback({ isConnected: true });

    expect(onOnline).not.toHaveBeenCalled();
    expect(onOffline).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function', () => {
    const unsub = subscribeToNetworkStatus(jest.fn(), jest.fn());

    expect(typeof unsub).toBe('function');

    unsub();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('treats null isConnected as offline', () => {
    const onOnline = jest.fn();
    const onOffline = jest.fn();

    subscribeToNetworkStatus(onOnline, onOffline);

    const callback = mockAddEventListener.mock.calls[0][0];

    // isConnected is null (unknown) -- treated as offline via ?? false
    callback({ isConnected: null });

    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(isOnline()).toBe(false);
  });
});
