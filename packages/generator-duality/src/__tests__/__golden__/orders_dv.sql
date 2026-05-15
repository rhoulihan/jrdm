CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS
SELECT JSON {
  '_id' : o.order_id,
  'orderTime' : o.order_datetime,
  'orderStatus' : o.order_status
}
FROM orders o WITH INSERT UPDATE DELETE;
