import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("bookstore.db");

try {
  // Initialize Database Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT CHECK(role IN ('admin', 'manager', 'staff', 'customer')) DEFAULT 'staff'
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE, -- ISBN
      barcode TEXT UNIQUE,
      name TEXT, -- Title
      author TEXT,
      description TEXT,
      category_id INTEGER,
      unit_price REAL,
      min_stock_level INTEGER DEFAULT 5,
      image_url TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      location_id INTEGER,
      quantity INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (location_id) REFERENCES locations(id),
      UNIQUE(product_id, location_id)
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      location_id INTEGER,
      type TEXT CHECK(type IN ('in', 'out', 'transfer', 'damaged', 'returned')),
      quantity INTEGER,
      reference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      total_amount REAL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price REAL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE,
      supplier_id INTEGER,
      status TEXT CHECK(status IN ('pending', 'received', 'cancelled')) DEFAULT 'pending',
      total_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS po_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price REAL,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
} catch (err) {
  console.error("Database initialization error:", err);
}

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", "admin123", "admin");
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("customer", "customer123", "customer");
  db.prepare("INSERT INTO locations (name, address) VALUES (?, ?)").run("Main Branch", "42 Library Lane");
  db.prepare("INSERT INTO locations (name, address) VALUES (?, ?)").run("City Center Branch", "101 Book Street");
  
  db.prepare("INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)").run("Penguin Random House", "Sarah Miller", "sarah@penguin.com", "555-0101", "New York, NY");
  db.prepare("INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)").run("HarperCollins", "John Davis", "john@harper.com", "555-0102", "London, UK");
  db.prepare("INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)").run("Oxford University Press", "Emma Wilson", "emma@oup.com", "555-0103", "Oxford, UK");
  
  const genres = ["Fiction", "Non-Fiction", "Sci-Fi", "Mystery", "Biography", "Children", "History"];
  genres.forEach(g => db.prepare("INSERT INTO categories (name) VALUES (?)").run(g));

  // Seed Books
  const books = [
    ['978-0141036144', '0141036144', '1984', 'George Orwell', 'Dystopian masterpiece', 1, 450.00, 10],
    ['978-0743273565', '0743273565', 'The Great Gatsby', 'F. Scott Fitzgerald', 'Classic American novel', 1, 350.00, 5],
    ['978-0451524935', '0451524935', '1984', 'George Orwell', 'Dystopian masterpiece', 1, 450.00, 10],
    ['978-0345391803', '0345391803', 'The Hitchhiker\'s Guide to the Galaxy', 'Douglas Adams', 'Sci-fi comedy', 3, 550.00, 8],
    ['978-0061120084', '0061120084', 'To Kill a Mockingbird', 'Harper Lee', 'Pulitzer Prize winner', 1, 399.00, 12],
    ['978-0544003415', '0544003415', 'The Lord of the Rings', 'J.R.R. Tolkien', 'Epic fantasy', 3, 1250.00, 4],
    ['978-0307474278', '0307474278', 'The Da Vinci Code', 'Dan Brown', 'Mystery thriller', 4, 499.00, 15],
    ['978-0316769174', '0316769174', 'The Catcher in the Rye', 'J.D. Salinger', 'Coming-of-age classic', 1, 320.00, 7],
    ['978-1408855652', '1408855652', 'Harry Potter and the Philosopher\'s Stone', 'J.K. Rowling', 'Fantasy', 6, 599.00, 20]
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (sku, barcode, name, author, description, category_id, unit_price, min_stock_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  books.forEach(b => insertProduct.run(...b));

  // Seed Stock
  const insertStock = db.prepare("INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?)");
  for (let i = 1; i <= 9; i++) {
    const qty = i === 6 ? 2 : Math.floor(Math.random() * 30) + 5;
    insertStock.run(i, 1, qty);
  }

  // Seed Sales
  const insertSale = db.prepare("INSERT INTO sales (invoice_number, total_amount, created_at) VALUES (?, ?, ?)");
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    insertSale.run(`INV-${2000 + i}`, Math.random() * 5000 + 500, date.toISOString());
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper for audit logging
  const logAction = (userId: number | null, action: string, details: string) => {
    try {
      db.prepare("INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)")
        .run(userId, action, details);
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  };

  // API Routes
  app.get("/api/test", (req, res) => {
    res.json({ message: "Server is alive", mode: process.env.NODE_ENV || 'development' });
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT id, username, role FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/register", (req, res) => {
    const { username, password } = req.body;
    try {
      const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const info = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password, "customer");
      const newUser = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(info.lastInsertRowid);
      
      logAction(Number(info.lastInsertRowid), "User Registered", `New customer account created: ${username}`);
      res.json(newUser);
    } catch (err: any) {
      res.status(500).json({ error: "Registration failed: " + err.message });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, username, role FROM users WHERE role = 'customer'").all();
    res.json(users);
  });

  app.get("/api/dashboard/stats", (req, res) => {
    const { userId, role } = req.query;

    if (role === 'customer' && userId) {
      const totalSpent = db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE user_id = ?").get(userId) as any;
      const totalOrders = db.prepare("SELECT COUNT(*) as count FROM sales WHERE user_id = ?").get(userId) as any;
      const booksBought = db.prepare(`
        SELECT SUM(si.quantity) as count 
        FROM sale_items si 
        JOIN sales s ON si.sale_id = s.id 
        WHERE s.user_id = ?
      `).get(userId) as any;

      return res.json({
        totalProducts: booksBought.count || 0,
        lowStock: 0,
        totalSales: totalSpent.total || 0,
        pendingPOs: totalOrders.count || 0,
        inventoryValue: 0
      });
    }

    const totalProducts = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;
    const lowStock = db.prepare(`
      SELECT COUNT(*) as count 
      FROM stock s 
      JOIN products p ON s.product_id = p.id 
      WHERE s.quantity <= p.min_stock_level
    `).get() as any;
    const totalSales = db.prepare("SELECT SUM(total_amount) as total FROM sales").get() as any;
    const pendingPOs = db.prepare("SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'pending'").get() as any;
    
    // Calculate total inventory value
    const stockValue = db.prepare(`
      SELECT SUM(s.quantity * p.unit_price) as total_value
      FROM stock s
      JOIN products p ON s.product_id = p.id
    `).get() as any;

    res.json({
      totalProducts: totalProducts.count,
      lowStock: lowStock.count,
      totalSales: totalSales.total || 0,
      pendingPOs: pendingPOs.count,
      inventoryValue: stockValue.total_value || 0
    });
  });

  app.get("/api/analytics/category-distribution", (req, res) => {
    const data = db.prepare(`
      SELECT c.name, COUNT(p.id) as value
      FROM categories c
      JOIN products p ON c.id = p.category_id
      GROUP BY c.id
    `).all();
    res.json(data);
  });

  app.get("/api/audit-logs", (req, res) => {
    const logs = db.prepare(`
      SELECT a.*, u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `).all();
    res.json(logs);
  });

  app.get("/api/external/book-lookup/:isbn", async (req, res) => {
    const { isbn } = req.params;
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      if (data.totalItems > 0) {
        const book = data.items[0].volumeInfo;
        res.json({
          title: book.title,
          author: book.authors ? book.authors.join(", ") : "Unknown",
          description: book.description || "",
          category: book.categories ? book.categories[0] : "Fiction",
          thumbnail: book.imageLinks ? book.imageLinks.thumbnail : null
        });
      } else {
        res.status(404).json({ error: "Book not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch book details" });
    }
  });

  app.get("/api/external/book-search", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query required" });
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q as string)}&maxResults=5`);
      const data = await response.json();
      if (data.totalItems > 0) {
        const results = data.items.map((item: any) => ({
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors ? item.volumeInfo.authors.join(", ") : "Unknown",
          description: item.volumeInfo.description || "No description available.",
          thumbnail: item.volumeInfo.imageLinks ? item.volumeInfo.imageLinks.thumbnail : null
        }));
        res.json(results);
      } else {
        res.status(404).json({ error: "No books found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to search books" });
    }
  });

  app.get("/api/products", (req, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, SUM(s.quantity) as total_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock s ON p.id = s.product_id
      GROUP BY p.id
    `).all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { sku, barcode, name, author, description, category_id, unit_price, min_stock_level, initial_stock, image_url, user_id } = req.body;
    const qty = parseInt(initial_stock) || 0;
    try {
      const transaction = db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO products (sku, barcode, name, author, description, category_id, unit_price, min_stock_level, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sku, barcode || sku, name, author, description, category_id, unit_price, min_stock_level, image_url);
        
        const productId = info.lastInsertRowid;
        
        // Initialize stock in Main Branch (location_id: 1)
        db.prepare("INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?)")
          .run(productId, 1, qty);

        // Record initial transaction
        if (qty > 0) {
          db.prepare(`
            INSERT INTO stock_transactions (product_id, location_id, type, quantity, reference_id)
            VALUES (?, ?, 'in', ?, 'Initial Stock')
          `).run(productId, 1, qty, 'Initial Stock');
        }
        
        logAction(user_id || null, "Created Product", `Added book: ${name} (SKU: ${sku}) with initial stock ${qty}`);
        return productId;
      });

      const id = transaction();
      res.json({ id });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/categories", (req, res) => {
    res.json(db.prepare("SELECT * FROM categories").all());
  });

  app.get("/api/suppliers", (req, res) => {
    res.json(db.prepare("SELECT * FROM suppliers").all());
  });

  app.post("/api/suppliers", (req, res) => {
    const { name, contact_person, email, phone, address } = req.body;
    const info = db.prepare(`
      INSERT INTO suppliers (name, contact_person, email, phone, address)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, contact_person, email, phone, address);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/locations", (req, res) => {
    res.json(db.prepare("SELECT * FROM locations").all());
  });

  app.post("/api/locations", (req, res) => {
    const { name, address, user_id } = req.body;
    try {
      const info = db.prepare("INSERT INTO locations (name, address) VALUES (?, ?)").run(name, address);
      logAction(user_id || null, "Created Branch", `Added new location: ${name}`);
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/stock", (req, res) => {
    const stock = db.prepare(`
      SELECT s.*, p.name as product_name, p.sku, l.name as location_name
      FROM stock s
      JOIN products p ON s.product_id = p.id
      JOIN locations l ON s.location_id = l.id
    `).all();
    res.json(stock);
  });

  app.post("/api/stock/adjust", (req, res) => {
    const { product_id, location_id, quantity, type, reference_id, user_id } = req.body;
    
    const transaction = db.transaction(() => {
      // Update or Insert stock
      const existing = db.prepare("SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?")
        .get(product_id, location_id) as any;
      
      let newQty = quantity;
      if (existing) {
        newQty = type === 'in' || type === 'returned' ? existing.quantity + quantity : existing.quantity - quantity;
        db.prepare("UPDATE stock SET quantity = ? WHERE product_id = ? AND location_id = ?")
          .run(newQty, product_id, location_id);
      } else {
        db.prepare("INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?)")
          .run(product_id, location_id, newQty);
      }

      // Record transaction
      db.prepare(`
        INSERT INTO stock_transactions (product_id, location_id, type, quantity, reference_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(product_id, location_id, type, quantity, reference_id);

      const prod = db.prepare("SELECT name FROM products WHERE id = ?").get(product_id) as any;
      logAction(user_id || null, "Adjusted Stock", `${type.toUpperCase()} adjustment of ${quantity} for ${prod?.name || 'Product ID '+product_id}`);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/sales/user/:userId", (req, res) => {
    const { userId } = req.params;
    const sales = db.prepare(`
      SELECT s.*, GROUP_CONCAT(p.name || ' (x' || si.quantity || ')') as items_summary
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all(userId);
    res.json(sales);
  });

  app.get("/api/sales/report", (req, res) => {
    const sales = db.prepare(`
      SELECT date(created_at) as date, SUM(total_amount) as total
      FROM sales
      GROUP BY date(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all();
    res.json(sales);
  });

  app.post("/api/orders", (req, res) => {
    const { user_id, items } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items in order" });
    }

    try {
      const transaction = db.transaction(() => {
        const invoiceNumber = `INV-${Date.now()}`;
        const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
        
        const saleInfo = db.prepare(`
          INSERT INTO sales (invoice_number, total_amount, user_id)
          VALUES (?, ?, ?)
        `).run(invoiceNumber, totalAmount, user_id);
        
        const saleId = saleInfo.lastInsertRowid;

        for (const item of items) {
          // Record sale item
          db.prepare(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
            VALUES (?, ?, ?, ?)
          `).run(saleId, item.product_id, item.quantity, item.unit_price);

          // Deduct stock from Main Branch (id: 1)
          const stock = db.prepare("SELECT quantity FROM stock WHERE product_id = ? AND location_id = 1").get(item.product_id) as any;
          if (!stock || stock.quantity < item.quantity) {
            throw new Error(`Insufficient stock for product ID ${item.product_id}`);
          }
          
          db.prepare("UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND location_id = 1")
            .run(item.quantity, item.product_id);

          // Record transaction
          db.prepare(`
            INSERT INTO stock_transactions (product_id, location_id, type, quantity, reference_id)
            VALUES (?, 1, 'out', ?, ?)
          `).run(item.product_id, item.quantity, invoiceNumber);
        }

        logAction(user_id, "Placed Order", `Customer placed order ${invoiceNumber} for ₹${totalAmount}`);
        return { saleId, invoiceNumber };
      });

      const result = transaction();
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/sales", (req, res) => {
    const { items, location_id, user_id } = req.body; // items: [{product_id, quantity, unit_price}]
    const invoice_number = "INV-" + Date.now();
    
    const transaction = db.transaction(() => {
      let total = 0;
      items.forEach((item: any) => total += item.quantity * item.unit_price);
      
      const saleInfo = db.prepare("INSERT INTO sales (invoice_number, total_amount, user_id) VALUES (?, ?, ?)")
        .run(invoice_number, total, user_id || null);
      const saleId = saleInfo.lastInsertRowid;

      for (const item of items) {
        db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)")
          .run(saleId, item.product_id, item.quantity, item.unit_price);
        
        // Update stock
        const existing = db.prepare("SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?")
          .get(item.product_id, location_id) as any;
        
        if (!existing || existing.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ID ${item.product_id}`);
        }

        db.prepare("UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND location_id = ?")
          .run(item.quantity, item.product_id, location_id);
        
        db.prepare(`
          INSERT INTO stock_transactions (product_id, location_id, type, quantity, reference_id)
          VALUES (?, ?, 'out', ?, ?)
        `).run(item.product_id, location_id, item.quantity, invoice_number);
      }
      logAction(user_id || null, "Sale Recorded", `Invoice ${invoice_number} for ₹${total.toLocaleString()}`);
      return saleId;
    });

    try {
      const id = transaction();
      res.json({ id, invoice_number });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/purchase-orders", (req, res) => {
    const pos = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `).all();
    res.json(pos);
  });

  app.post("/api/purchase-orders", (req, res) => {
    const { supplier_id, items } = req.body; // items: [{product_id, quantity, unit_price}]
    const po_number = "PO-" + Date.now();
    
    const transaction = db.transaction(() => {
      let total = 0;
      items.forEach((item: any) => total += item.quantity * item.unit_price);
      
      const poInfo = db.prepare("INSERT INTO purchase_orders (po_number, supplier_id, total_amount, status) VALUES (?, ?, ?, 'pending')")
        .run(po_number, supplier_id, total);
      const poId = poInfo.lastInsertRowid;

      for (const item of items) {
        db.prepare("INSERT INTO po_items (po_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)")
          .run(poId, item.product_id, item.quantity, item.unit_price);
      }
      return poId;
    });

    try {
      const id = transaction();
      res.json({ id, po_number });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/purchase-orders/:id/receive", (req, res) => {
    const { id } = req.params;
    const { location_id, user_id } = req.body;
    
    const transaction = db.transaction(() => {
      const po = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as any;
      if (!po) throw new Error("Purchase order not found");
      if (po.status !== 'pending') throw new Error("Order already processed");

      const items = db.prepare("SELECT * FROM po_items WHERE po_id = ?").all(id) as any[];
      
      for (const item of items) {
        // Update stock
        const existing = db.prepare("SELECT id FROM stock WHERE product_id = ? AND location_id = ?")
          .get(item.product_id, location_id) as any;
        
        if (existing) {
          db.prepare("UPDATE stock SET quantity = quantity + ? WHERE id = ?")
            .run(item.quantity, existing.id);
        } else {
          db.prepare("INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?)")
            .run(item.product_id, location_id, item.quantity);
        }
        
        db.prepare(`
          INSERT INTO stock_transactions (product_id, location_id, type, quantity, reference_id)
          VALUES (?, ?, 'in', ?, ?)
        `).run(item.product_id, location_id, item.quantity, po.po_number);
      }

      db.prepare("UPDATE purchase_orders SET status = 'received' WHERE id = ?").run(id);
      logAction(user_id || null, "Received PO", `Order ${po.po_number} received into stock`);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html: ${err.message}`);
          res.status(404).send("Front-end build not found. Please run build first.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
  });
}

startServer();
