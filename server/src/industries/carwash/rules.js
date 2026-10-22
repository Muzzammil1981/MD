/* Car wash / detailing: asks for the vehicle, no group bookings. Only the differences from _default: */
export default {
    booking: { allowGroup: false, defaultDurationMinutes: 45 },
    intakeFields: [
        { key: "vehicleNumber", label: "Vehicle number", type: "text", required: true },
        { key: "vehicleType", label: "Vehicle type", type: "select", options: ["Hatchback", "Sedan", "SUV", "Bike"], required: true },
    ],
};
