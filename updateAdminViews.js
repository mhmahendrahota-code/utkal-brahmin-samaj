const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'views', 'admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.ejs'));

files.forEach(file => {
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Case 1: Full HTML Document Boilerplate (surnames.ejs, etc)
  const boilerplateRegex = /<!DOCTYPE html>[\s\S]*?<%- include\('\.\.\/partials\/header'\) %>[\s\S]*?<body[^>]*>/i;
  if (boilerplateRegex.test(content)) {
    content = content.replace(boilerplateRegex, "<%- include('partials/admin-header') %>");
  }

  // Case 2: Simple include (dashboard.ejs, members.ejs, etc)
  content = content.replace(/<%- include\('\.\.\/partials\/header'\) %>/g, "<%- include('partials/admin-header') %>");

  // Footers
  content = content.replace(/<%- include\('\.\.\/partials\/footer'\) %>/g, "<%- include('partials/admin-footer') %>");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
