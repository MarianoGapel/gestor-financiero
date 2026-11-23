<script setup>
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  datos: {
    type: Array,
    default: () => []
  },
  moneda: {
    type: String,
    default: 'USD'
  },
  simbolo: {
    type: String,
    default: 'US$'
  }
})

const modo = ref('gastos') // 'gastos' | 'comparativa'

const totalGastosMeses = computed(() =>
  props.datos.reduce((acc, m) => acc + Number(m.gastos || 0), 0)
)

const promedioMensualGastos = computed(() => {
  if (!props.datos.length) return 0
  return totalGastosMeses.value / props.datos.length
})

const chartData = computed(() => {
  const labels = props.datos.map((m) => m.etiqueta)

  if (modo.value === 'comparativa') {
    return {
      labels,
      datasets: [
        {
          label: `Ingresos (${props.moneda})`,
          data: props.datos.map((m) => Number(m.ingresos || 0)),
          backgroundColor: '#c2652a',
          hoverBackgroundColor: '#a3511e',
          borderRadius: 8,
          maxBarThickness: 32
        },
        {
          label: `Gastos (${props.moneda})`,
          data: props.datos.map((m) => Number(m.gastos || 0)),
          backgroundColor: '#9c4138',
          hoverBackgroundColor: '#7f322b',
          borderRadius: 8,
          maxBarThickness: 32
        }
      ]
    }
  }

  return {
    labels,
    datasets: [
      {
        label: `Gastos mensuales (${props.moneda})`,
        data: props.datos.map((m) => Number(m.gastos || 0)),
        backgroundColor: '#9c4138',
        hoverBackgroundColor: '#7f322b',
        borderRadius: 10,
        maxBarThickness: 44
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: modo.value === 'comparativa',
      position: 'top',
      align: 'end',
      labels: {
        usePointStyle: true,
        boxWidth: 8,
        font: { size: 11, weight: '600' },
        color: '#52443c'
      }
    },
    tooltip: {
      backgroundColor: '#231a15',
      padding: 12,
      cornerRadius: 10,
      callbacks: {
        label(ctx) {
          const val = Number(ctx.parsed.y || 0).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
          return ` ${ctx.dataset.label}: ${props.simbolo}${val}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#52443c',
        font: { size: 11, weight: '600' }
      }
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: {
        color: 'rgba(133, 115, 106, 0.14)'
      },
      ticks: {
        color: '#85736a',
        font: { size: 11 },
        callback(value) {
          return `${props.simbolo}${Number(value).toLocaleString('es-AR')}`
        }
      }
    }
  }
}))
</script>

<template>
  <div class="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col justify-between">
    <div>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <span class="text-[11px] font-bold tracking-widest text-tertiary uppercase">Comparativa Mensual</span>
          <h3 class="font-headline text-2xl text-on-surface font-medium">
            {{ modo === 'gastos' ? `Gastos por Mes (${moneda})` : `Ingresos vs. Gastos (${moneda})` }}
          </h3>
        </div>

        <div class="inline-flex p-1 bg-surface-container-low rounded-xl text-[11px] font-semibold self-start">
          <button
            type="button"
            @click="modo = 'gastos'"
            :class="[
              'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
              modo === 'gastos' ? 'bg-surface-container-lowest text-tertiary shadow-sm' : 'text-on-surface-variant'
            ]"
          >
            Solo Gastos
          </button>
          <button
            type="button"
            @click="modo = 'comparativa'"
            :class="[
              'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
              modo === 'comparativa' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            ]"
          >
            Ingresos vs. Gastos
          </button>
        </div>
      </div>

      <div v-if="!datos.length" class="p-10 rounded-2xl bg-surface-container-low text-center text-xs text-secondary">
        Aún no hay movimientos mensuales registrados en {{ moneda }}.
      </div>

      <div v-else class="h-64 sm:h-72 w-full mt-2">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div class="pt-5 mt-6 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
      <span>Promedio de meses con movimientos ({{ datos.length }} {{ datos.length === 1 ? 'mes' : 'meses' }})</span>
      <span class="font-mono font-semibold text-tertiary">
        -{{ simbolo }}{{ promedioMensualGastos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
      </span>
    </div>
  </div>
</template>