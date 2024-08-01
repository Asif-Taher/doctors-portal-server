const express = require('express');
const  jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, Admin } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // Add this line to parse JSON bodies

// MongoDB connection code
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cfzij7e.mongodb.net/?appName=Cluster0`;
console.log('MongoDB URI:', uri);

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


//jwt function 
function verifyJWT(req,res,next){
 const authHeader = req.headers.authorization;
 if(!authHeader){
  return res.status(401).send({message: 'UnAuthorized access'});
 }
 const token = authHeader.split(' ')[1];
 jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
    if(err){
      return  res.status(401).send({message: 'Forbidden acces'});
    }
    req.decoded = decoded;
    next();
});
}

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    const serviceCollection = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });


    //for user

    app.get('/user',verifyJWT, async(req,res)=>{
      const users = await userCollection.find().toArray();
      res.send(users);
    })

    //Get Admin
    app.get('/admin/:email', async (req, res) =>{
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin});
    })
    //for user admin to store mongdb
    app.put('/user/admin/:email', verifyJWT, async(req,res)=>{
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email:requester});
      if(requesterAccount.role === 'admin'){
        const filter =  {email: email};
        const updateDoc = {
          $set: {role: 'admin'},
        };
        const result = await userCollection.updateOne(filter,updateDoc);
        res.send(result);
      }
      else{
        res.status(403).send({message: 'forbidden'})
      }
     
    })
    app.put('/user/:email', async(req,res)=>{
      const email = req.params.email;
      const user = req.body;
      const filter =  {email: email};
      const options = {upsert: true};
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter,updateDoc,options);
      const token = jwt.sign({email : email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res.send({result, token});
    })
    //for available 
    app.get('/available', async(req,res)=>{
      const date = req.query.date || 'Jul 16, 2024';
      const services = await serviceCollection.find().toArray();


      const query = {date: date};
      const bookings = await bookingCollection.find(query).toArray();

      services.forEach(service =>{
          const serviceBookings = bookings.filter(b => b.treatment === service.name);
          const booked = serviceBookings.map(s => s.slot);
        const available = service.slots.filter(s =>!booked.includes(s));
        service.available = available;
      })
      res.send(services);
    })
// this is booing api 

    //for get
    
    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if(patient === decodedEmail){
        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray();
        console.log('Bookings:', bookings);
       return res.send(bookings);
      }
      else{
        return res.status(403).send({message: 'forbidden access'});
      }
      
      if (!patient) {
        return res.status(400).send({ message: "Patient query parameter is required" });
      }
    

    });
    

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    })
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from doctor portal');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
