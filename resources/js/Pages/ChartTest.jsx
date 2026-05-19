// BarChart.jsx
import React from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// Chart configuration
const options = {
    responsive: true,
    plugins: {
        title: {
            display: true,
            text: "Sample Bar Chart",
        },
    },
};

const labels = ["January", "February", "March", "April", "May"];

const data = {
    labels,
    datasets: [
        {
            label: "Sales",
            data: [150, 200, 180, 220, 160],
            backgroundColor: "rgba(75,192,192,0.6)",
        },
    ],
};

export default function ChartTest() {
    return <Bar options={options} data={data} />;
}
