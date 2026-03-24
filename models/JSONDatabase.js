const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

// Ensure DB file exists
function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ members: [], events: [], donations: [], announcements: [] }));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

class JSONDatabase {
  constructor(data) {
    Object.assign(this, data);
    if (!this._id) this._id = generateId();
    if (!this.createdAt) this.createdAt = new Date();
    if (!this.updatedAt) this.updatedAt = new Date();
  }

  async save() {
    const db = readDb();
    const collection = this.constructor.collectionName;
    if (!db[collection]) db[collection] = [];
    
    // Check if updating existing or inserting new
    const index = db[collection].findIndex(item => item._id === this._id);
    if (index !== -1) {
      this.updatedAt = new Date();
      db[collection][index] = this;
    } else {
      db[collection].push(this);
    }
    
    writeDb(db);
    return this;
  }

  static get collectionName() { 
    return 'default'; 
  }

  static find(query = {}) {
    const collName = this.collectionName;
    return {
      sortObj: null,
      limitNum: null,
      sort(obj) { this.sortObj = obj; return this; },
      limit(num) { this.limitNum = num; return this; },
      then(resolve, reject) {
        try {
          const db = readDb();
          let records = db[collName] || [];

          if (Object.keys(query).length > 0) {
            records = records.filter(item => {
              let matches = true;
              for (let key in query) {
                if (key === '$or') continue;
                let itemValue = item[key];
                if (key.includes('.')) {
                  const parts = key.split('.');
                  itemValue = item[parts[0]] ? item[parts[0]][parts[1]] : undefined;
                }
                const qValue = query[key];
                if (qValue !== undefined && qValue !== null) {
                  if (typeof qValue === 'object' && qValue.$ne !== undefined) {
                    if (itemValue === qValue.$ne) matches = false;
                  } else if (qValue instanceof RegExp) {
                    if (!qValue.test(itemValue)) matches = false;
                  } else if (itemValue !== qValue) {
                    matches = false;
                  }
                }
              }
              return matches;
            });
          }

          records = records.map(r => {
            if(r.date) r.date = new Date(r.date);
            if(r.createdAt) r.createdAt = new Date(r.createdAt);
            if(r.updatedAt) r.updatedAt = new Date(r.updatedAt);
            if(r.expiryDate) r.expiryDate = new Date(r.expiryDate);
            if(r.matrimonialProfile && r.matrimonialProfile.dateOfBirth) {
              r.matrimonialProfile.dateOfBirth = new Date(r.matrimonialProfile.dateOfBirth);
            }
            return r;
          });

          if (this.sortObj) {
            const key = Object.keys(this.sortObj)[0];
            const dir = this.sortObj[key];
            records.sort((a, b) => {
              let valA = a[key]; let valB = b[key];
              if (key.includes('.')) {
                const parts = key.split('.');
                valA = a[parts[0]] ? a[parts[0]][parts[1]] : null;
                valB = b[parts[0]] ? b[parts[0]][parts[1]] : null;
              }
              if (valA < valB) return dir === 1 ? -1 : 1;
              if (valA > valB) return dir === 1 ? 1 : -1;
              return 0;
            });
          }

          if (this.limitNum) {
            records = records.slice(0, this.limitNum);
          }

          resolve(records);
        } catch(e) {
          reject(e);
        }
      }
    };
  }
  
  static async findById(id) {
    const db = readDb();
    const item = (db[this.collectionName] || []).find(i => i._id === id);
    if(item) {
        if(item.date) item.date = new Date(item.date);
        if(item.createdAt) item.createdAt = new Date(item.createdAt);
        if(item.updatedAt) item.updatedAt = new Date(item.updatedAt);
        if(item.expiryDate) item.expiryDate = new Date(item.expiryDate);
        if(item.matrimonialProfile && item.matrimonialProfile.dateOfBirth) {
            item.matrimonialProfile.dateOfBirth = new Date(item.matrimonialProfile.dateOfBirth);
        }
    }
    return item;
  }
  
  static async countDocuments(query = {}) {
    const res = await this.find(query);
    return res.length;
  }

  static async findByIdAndDelete(id) {
    const db = readDb();
    const colLength = (db[this.collectionName] || []).length;
    db[this.collectionName] = (db[this.collectionName] || []).filter(i => i._id !== id);
    if (db[this.collectionName].length !== colLength) {
      writeDb(db);
    }
    return true;
  }

  static async aggregate(pipeline) {
    const db = readDb();
    const records = db[this.collectionName] || [];
    
    // Specific hardcode for the Donation Sum query we use in the app
    if (this.collectionName === 'donations' && pipeline[0] && pipeline[0].$group && pipeline[0].$group.total) {
      const total = records.reduce((sum, item) => sum + Number(item.amount), 0);
      return [{ total }];
    }
    return [];
  }
   
  static async findByIdAndUpdate(id, update) {
    const db = readDb();
    const records = db[this.collectionName] || [];
    const index = records.findIndex(i => i._id === id);
    
    if (index !== -1) {
      // Determine the actual update fields (handle $set and $inc operators)
      const setFields = update.$set || (update.$inc ? {} : update);
      
      if (update.$inc) {
        for (const key in update.$inc) {
          records[index][key] = (records[index][key] || 0) + update.$inc[key];
        }
      }

      for (const key in setFields) {
        if (key.startsWith('$')) continue;
        if (key.includes('.')) {
          const parts = key.split('.');
          if (!records[index][parts[0]]) records[index][parts[0]] = {};
          records[index][parts[0]][parts[1]] = setFields[key];
        } else {
          records[index][key] = setFields[key];
        }
      }

      records[index].updatedAt = new Date();
      writeDb(db);
      return records[index];
    }
    return null;
  }
}

module.exports = JSONDatabase;
