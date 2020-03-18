var express = require('express');
var exphbs  = require('express-handlebars');
var mp = require('mercadopago');

mp.configure({
  sandbox: true,
  access_token: 'APP_USR-6317427424180639-090914-5c508e1b02a34fcce879a999574cf5c9-469485398'
});

var app = express();
 
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.get('/', function (req, res) {
    res.render('home');
});

app.get('/detail', function (req, res) {
    res.render('detail', req.query);
});

app.get('/mp/initpoint', async function(req, res) {
  const title = typeof(req.query.title) === 'string' ? req.query.title : undefined;
  const img = typeof(req.query.img) === 'string' ? req.query.img: undefined;
  const price = typeof(req.query.price) === 'string' ? parseInt(req.query.price): undefined;
  const unit = typeof(req.query.unit) === 'string' ? parseInt(req.query.unit): undefined;
  if (title && img && price && unit) {
    let preference = {
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
      notification_url: 'http://arcos1726.dyndns.org:3000/mp/notification',
      back_urls: {
        "success": "http://localhost:3000/success",
        "failure": "http://localhost:3000/failure",
        "pending": "http://localhost:3000/pending"
      },
      auto_return: 'approved'
    };
    try {
      let result = await mp.preferences.create(preference)  
      res.redirect(result.body.init_point);  
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
  try {
    let data = await mp.ipn.manage(req);
    console.log(data);
    if (data.topic === 'payment') {
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
    }  
  } catch(err) {
    console.error(err);
  }
  res.status(200);
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
