const GET_CAR_COMMAND = {
    "name": "car",
    "description": "Get a car's MOT and Vehicle Information",
    "options": [
        {
            "name": "reg",
            "description": "The license plate of the car. without spaces.",
            "type": 3,
            "required": true,
            "min_length": 2,
            "max_length": 7
        }
    ]
}

module.exports = {
    GET_CAR_COMMAND
}