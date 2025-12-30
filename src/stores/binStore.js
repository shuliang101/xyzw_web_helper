import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'

export const useBinStore = defineStore('bins', () => {
  const bins = ref([])
  const isLoading = ref(false)

  const fetchBins = async () => {
    try {
      isLoading.value = true
      const { bins: list } = await api.bins.list()
      bins.value = list
    } finally {
      isLoading.value = false
    }
  }

  const uploadBin = async (file) => {
    const form = new FormData()
    form.append('bin', file)
    await api.bins.upload(form)
    await fetchBins()
  }

  const removeBin = async (id) => {
    await api.bins.remove(id)
    bins.value = bins.value.filter(bin => bin.id !== id)
  }

  return {
    bins,
    isLoading,
    fetchBins,
    uploadBin,
    removeBin
  }
})
