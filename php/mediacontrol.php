<?php
session_start();

if (!isset($_SESSION['giris_yapildi']) || $_SESSION['giris_yapildi'] !== true) {
  header('HTTP/1.0 403 Forbidden');
  echo "Bu dosyaya erişim izniniz yok.";
  exit;
}

$dosyaYolu = $_SERVER['DOCUMENT_ROOT'] . 'deleted_media/' . $_GET['dosya'];

if (file_exists($dosyaYolu)) {
  header('Content-Type: ' . mime_content_type($dosyaYolu));
  readfile($dosyaYolu);
} else {
  header('HTTP/1.0 404 Not Found');
  echo "Dosya bulunamadı.";
}
?>