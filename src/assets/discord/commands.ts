const GET_CAR_COMMAND = {
    "name": "car",
    "description": "Get a from it's reg plate",
    "options": [
        {
            "name": "reg",
            "description": "The registration plate of the car",
            "type": 3,
            "required": true
        }
    ]
}

export {
    GET_CAR_COMMAND
}