const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [], assessments: [], submissions: [], nextId: { users: 1, assessments: 1, submissions: 1 } };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function seed() {
  const data = load();
  if (!data.users.some(u => u.role === 'instructor')) {
    data.users.push({
      id: data.nextId.users++,
      role: 'instructor',
      fullname: 'Default Instructor',
      student_id: 'INST-001',
      password: bcrypt.hashSync('instructor123', 10),
      block: null,
      year: null,
      created_at: new Date().toISOString()
    });
    save(data);
  }
}

seed();

module.exports = {
  load,
  save,
  table(name) {
    return {
      get idField() {
        return name === 'users' ? 'id' : 'id';
      },
      all() { return load()[name]; },
      find(predicate) { return load()[name].find(predicate); },
      filter(predicate) { return load()[name].filter(predicate); },
      insert(record) {
        const data = load();
        record.id = data.nextId[name]++;
        data[name].push(record);
        save(data);
        return record;
      },
      update(id, changes) {
        const data = load();
        const idx = data[name].findIndex(r => r.id === id);
        if (idx >= 0) {
          data[name][idx] = { ...data[name][idx], ...changes };
          save(data);
          return data[name][idx];
        }
        return null;
      }
    };
  }
};
