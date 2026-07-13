const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export async function api(endpoint, method = "GET", body = null) {
  const token = localStorage.getItem("token")

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      "Accept-Language": localStorage.getItem("i18nextLng") || "en"
    },
    ...(body && { body: JSON.stringify(body) })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    // If we're offline but the browser cached a response, it might be ok
    // But usually fetch throws when offline

    const data = await res.json()
    if (!res.ok) throw data
    return data

  } catch (err) {
    // Check if it's a network error (Offline)
    if (err?.message && (err.message === "Failed to fetch" || err.message.includes("NetworkError"))) {

      // Only queue data modification requests (exclude Auth)
      if (['POST', 'PUT', 'PATCH'].includes(method) && !endpoint.startsWith("/auth")) {
        console.warn("🌐 Offline: Queueing request", endpoint)

        const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]')
        queue.push({
          endpoint,
          method,
          body,
          timestamp: Date.now(),
          id: Date.now() + Math.random() // Unique ID
        })
        localStorage.setItem('offlineQueue', JSON.stringify(queue))

        // Return a mock success so UI doesn't break
        return {
          offline: true,
          message: "Saved to offline queue. Will sync when online."
        }
      }
    }
    throw err
  }
}

// Function to sync pending requests
export async function syncPendingRequests() {
  const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]')
  if (queue.length === 0) return { count: 0 }

  console.log(`🔄 Syncing ${queue.length} offline requests...`)

  const failed = []
  let syncedCount = 0

  for (const item of queue) {
    try {
      // We skip the wrapper and call fetch directly to avoid re-queueing
      const token = localStorage.getItem("token")
      const options = {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: item.body ? JSON.stringify(item.body) : null
      }

      const res = await fetch(`${API_URL}${item.endpoint}`, options)
      if (!res.ok) throw new Error("Sync failed")

      syncedCount++
    } catch (err) {
      console.error("Sync failed for item:", item, err)
      failed.push(item) // Keep in queue
    }
  }

  // Update queue with only failed items
  localStorage.setItem('offlineQueue', JSON.stringify(failed))

  return {
    count: syncedCount,
    failed: failed.length
  }
}

// Helper to check queue status
export function getOfflineQueueStatus() {
  const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]')
  return {
    count: queue.length,
    hasPending: queue.length > 0
  }
}