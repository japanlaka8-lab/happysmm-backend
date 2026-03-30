require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI);

// MODELS
const User = mongoose.model("User", {
  username: String,
  password: String,
  balance: { type: Number, default: 0 }
});

const Order = mongoose.model("Order", {
  userId: String,
  service: Number,
  link: String,
  quantity: Number,
  apiOrderId: String,
  status: String
});

const Service = mongoose.model("Service", {
  name: String,
  apiId: Number,
  rate: Number
});

// API CONFIG
const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

// REGISTER
app.post("/register", async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});

// LOGIN
app.post("/login", async (req, res) => {
  const user = await User.findOne(req.body);
  res.json(user || { error: "Invalid login" });
});

// SERVICES
app.get("/services", async (req, res) => {
  res.json(await Service.find());
});

// SYNC SERVICES
app.get("/sync-services", async (req, res) => {
  const response = await axios.post(API_URL, null, {
    params: { key: API_KEY, action: "services" }
  });

  for (let s of response.data) {
    await Service.updateOne(
      { apiId: s.service },
      {
        name: s.name,
        rate: (s.rate * 2).toFixed(2),
        apiId: s.service
      },
      { upsert: true }
    );
  }

  res.json({ success: true });
});

// ORDER
app.post("/order", async (req, res) => {
  const { userId, service, link, quantity } = req.body;

  const response = await axios.post(API_URL, null, {
    params: {
      key: API_KEY,
      action: "add",
      service,
      link,
      quantity
    }
  });

  const order = await Order.create({
    userId,
    service,
    link,
    quantity,
    apiOrderId: response.data.order,
    status: "Pending"
  });

  res.json(order);
});

// UPDATE STATUS
app.get("/update-status", async (req, res) => {
  const orders = await Order.find({ status: "Pending" });

  for (let o of orders) {
    const response = await axios.post(API_URL, null, {
      params: {
        key: API_KEY,
        action: "status",
        order: o.apiOrderId
      }
    });

    o.status = response.data.status;
    await o.save();
  }

  res.json({ done: true });
});

app.listen(3000, () => console.log("HappySMM Server running"));