var express = require('express');
var exphbs  = require('express-handlebars');
var mp = require('mercadopago');
var bodyParser = require('body-parser');

mp.configure({
  sandbox: true,
  access_token: 'APP_USR-6317427424180639-090914-5c508e1b02a34fcce879a999574cf5c9-469485398'
});

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.get('/', function (req, res) {
    res.render('home');
});

app.get('/detail', function (req, res) {
    res.render('detail', req.query);
});

app.post('/mp/preference', async function(req, res) {
  const title = typeof(req.body.title) === 'string' ? req.body.title : undefined;
  const img = typeof(req.body.img) === 'string' ? req.body.img: undefined;
  const price = typeof(req.body.price) === 'string' ? parseInt(req.body.price): undefined;
  const unit = typeof(req.body.unit) === 'string' ? parseInt(req.body.unit): undefined;
  const name = typeof(req.body.name) === 'string' ? req.body.name : undefined;
  const surname = typeof(req.body.surname) === 'string' ? req.body.surname : undefined;
  const email = typeof(req.body.email) === 'string' ? req.body.email : undefined;
  const dni = typeof(req.body.dni) === 'string' ? req.body.dni : undefined;
  const zip = typeof(req.body.zip) === 'string' ? req.body.zip : undefined;
  const street = typeof(req.body.street) === 'string' ? req.body.street : undefined;
  const num = typeof(req.body.number) === 'string' ? parseInt(req.body.number) : undefined;
  if (title && img && price && unit) {
    let preference = {
      payer: {
        name,
        surname,
        email,
        identification: {
          type: 'dni',
          number: dni
        },
        address: {
          zip_code: zip,
          street_name: street,
          street_number: num
        }
      },
      items: [
        {
          title: title,
          description: 'Dispositivo móvil de Tienda e-commerce',
          image_url: img,
          unit_price: price,
          quantity: unit
        }
      ],
      external_reference: 'ABCD1234',
      payment_methods: {
        excluded_payment_methods: [
          { id: 'amex' }
        ],
        excluded_payment_types: [
          { id: 'atm' }
        ],
        installments: 6,
      },
      notification_url: 'http://181.192.38.69:3000/mp/notification',
      back_urls: {
        "success": "http://localhost:3000/success",
        "failure": "http://localhost:3000/failure",
        "pending": "http://localhost:3000/pending"
      },
      auto_return: 'approved'
    };
    try {
      let result = await mp.preferences.create(preference);
      console.log('PreferenceID:',result.body.id);
      res.setHeader('Content-Type', 'text/html');
      res.status(200);
      res.send(result.body.id);
      res.end();
    } catch(err) {
      console.error(err);
      res.status(500);
      res.end();
    }
  } else {
    res.status(400);
    res.end();
  }
});

app.post('/mp/notification', async function(req, res) {
  console.log('Notification', req.query);
  if (req.query.topic === 'payment') {
    console.log('PaymentID:', req.query.id);
    try {
      let data = await mp.ipn.manage(req);
      let merchant_order = await mp.merchant_orders.get(data.body.order.id);
      let paid_amount = 0;
      merchant_order.body.payments.forEach(function(p) {
        if (p.status === 'approved') {
          paid_amount += p.transaction_amount;
        }
      });
      if (paid_amount >= merchant_order.body.total_amount) {
        console.log(`Payment ${data.body.order.id} completed!`);
      }
    } catch(err) {
      console.error(err);
    }  
  }
  res.status(200);
  res.end();
});

app.post('/procesar-pago', async function(req, res) {
  res.writeHead(301, {'Location': req.body.back_url});
  res.end();  
});

app.get('/success', async function(req, res) {
  get_order_number(req.query.merchant_order_id)
  .then(function(query) {
    res.render('success', query);
  })
  .catch(function(err) {
    console.error(err);
    res.status(400);
    res.end();
  });
});

app.get('/failure', function(req, res) {
  get_order_number(req.query.merchant_order_id)
  .then(function(query) {
    res.render('failure', query);
  })
  .catch(function(err) {
    console.error(err);
    res.status(400);
    res.end();
  });
});

app.get('/pending', function(req, res) {
  get_order_number(req.query.merchant_order_id)
  .then(function(query) {
    res.render('pending', query);
  })
  .catch(function(err) {
    console.error(err);
    res.status(400);
    res.end();
  });
});

app.use(express.static('assets'));
 
app.use('/assets', express.static(__dirname + '/assets'));
 
app.listen(3000);

async function get_order_number(id) {
  let query;
  let merchant_order = await mp.merchant_orders.get(id);
  query = {
    order_number: merchant_order.body.external_reference
  };
  return query;
}
