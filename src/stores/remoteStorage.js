import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'

export const useRemoteStorageStore = defineStore('remoteStorage', () => {
  const items = ref([])
  const isLoading = ref(false)

  const load = async () => {
    isLoading.value = true
    try {
      const { records } = await api.storage.list()
      items.value = records
    } finally {
      isLoading.value = false
    }
  }

  const save = async (key, value) => {
    await api.storage.set(key, value)
    await load()
  }

  const remove = async (key) => {
    await api.storage.remove(key)
    items.value = items.value.filter(item => item.key !== key)
  }

  return {
    items,
    isLoading,
    load,
    save,
    remove
  }
})
