function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('SAMPUR - Kapanewon Depok')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function getUploadFolder() {
  var folderName = "Surat Permohonan Peminjaman Tempat";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) { return folders.next(); } 
  else { return DriveApp.createFolder(folderName); }
}

function getSpreadsheetData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone();
  
  var sheetRuangan = ss.getSheetByName('Ruangan');
  var dataRuangan = [];
  if (sheetRuangan) {
    var vals = sheetRuangan.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      if (vals[i][0]) dataRuangan.push({ nama: vals[i][0], kapasitas: vals[i][1], fasilitas: vals[i][2] });
    }
  }
  
  var sheetBookings = ss.getSheetByName('Bookings');
  var dataBookings = [];
  if (sheetBookings) {
    var vals = sheetBookings.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      if (!vals[i][1]) continue;
      var formattedDate = (vals[i][9] instanceof Date) ? Utilities.formatDate(vals[i][9], tz, "yyyy-MM-dd") : vals[i][9];
      dataBookings.push({
        idBooking: vals[i][1],
        penanggungJawab: vals[i][2],
        kontak: vals[i][3],
        instansi: vals[i][4],           
        detailInstansi: vals[i][5],     
        ruangan: vals[i][7],
        kegiatan: vals[i][8],
        tanggal: formattedDate,
        jamMulai: formatTimeSafe(vals[i][10], tz),
        jamSelesai: formatTimeSafe(vals[i][11], tz),
        status: vals[i][12] || 'Pending'
      });
    }
  }
  return { ruangan: dataRuangan, bookings: dataBookings };
}

function formatTimeSafe(timeVal, tz) {
  if (timeVal instanceof Date) return Utilities.formatDate(timeVal, tz, "HH:mm");
  return timeVal ? timeVal.toString().substring(0,5) : "00:00";
}

function timeToMinutes(timeStr) {
  var parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function padZero(num) {
  return num < 10 ? '0' + num : num;
}

function isOutsideOperationalHours(jamMulai, jamSelesai) {
  var mulaiMin = timeToMinutes(jamMulai);
  var selesaiMin = timeToMinutes(jamSelesai);
  if (mulaiMin < 240 || selesaiMin > 1380 || mulaiMin >= 1380) {
    return true;
  }
  return false;
}

// FUNGSI BARU: Untuk memformat Timestamp agar rapi
function formatTimestampSampur(date) {
  if (!date || date === "" || isNaN(Date.parse(date))) return "-";
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "dd MMM yyyy, HH:mm") + " WIB";
}

function submitBooking(form) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Bookings');
    var tz = Session.getScriptTimeZone();
    
    var waClean = form.kontak.replace(/[^0-9]/g, '');
    if (!waClean.startsWith('08') && !waClean.startsWith('628')) {
      return { success: false, message: 'Nomor WA harus valid area Indonesia (diawali 08 atau 628).' };
    }

    if (form.instansi === 'Lainnya' && !form.fileData) {
      return { success: false, message: 'Sistem Menolak: Instansi Luar WAJIB mengunggah dokumen Surat Permohonan.' };
    }

    var idBooking = "BKG-" + Math.floor(1000 + Math.random() * 9000);
    var schedules = form.jadwal;
    var existingVals = sheet.getDataRange().getValues();
    var bufferMenit = 30; 
    
    for (var i = 0; i < schedules.length; i++) {
      var reqSched = schedules[i];
      if (form.instansi !== 'Kapanewon Depok') {
        if (isOutsideOperationalHours(reqSched.jamMulai, reqSched.jamSelesai)) {
          return { 
            success: false, 
            message: 'Sistem Menolak: Instansi luar tidak dapat meminjam pada jam malam (23:00 - 04:00 WIB). Hubungi Sekretariat Kapanewon untuk kondisi mendesak.' 
          };
        }
      }

      var reqMulaiMin = timeToMinutes(reqSched.jamMulai);
      var reqSelesaiMin = timeToMinutes(reqSched.jamSelesai);
      
      for (var j = 1; j < existingVals.length; j++) {
        var exStatus = existingVals[j][12] ? existingVals[j][12].toString().toLowerCase() : '';
        var exRuangan = existingVals[j][7];
        var exTanggal = (existingVals[j][9] instanceof Date) ? Utilities.formatDate(existingVals[j][9], tz, "yyyy-MM-dd") : existingVals[j][9];
        
        if (exStatus === 'disetujui' && exRuangan === form.ruangan && exTanggal === reqSched.tanggal) {
          var exMulai = formatTimeSafe(existingVals[j][10], tz);
          var exSelesai = formatTimeSafe(existingVals[j][11], tz);
          var exMulaiMin = timeToMinutes(exMulai);
          var exSelesaiMin = timeToMinutes(exSelesai);
          var exSelesaiWithBuffer = exSelesaiMin + bufferMenit;
          
          if (reqMulaiMin < exSelesaiWithBuffer && reqSelesaiMin > exMulaiMin) {
            var jamBisaBooking = padZero(Math.floor(exSelesaiWithBuffer / 60)) + ":" + padZero(exSelesaiWithBuffer % 60);
            return { 
              success: false, 
              message: 'Gagal Submit: ' + form.ruangan + ' sudah disetujui untuk kegiatan lain pada pukul ' + exMulai + ' s.d ' + exSelesai + ' WIB. Mengingat petugas perlu waktu ' + bufferMenit + ' menit untuk pembersihan & penataan ulang ruangan, tempat baru dapat digunakan kembali mulai pukul ' + jamBisaBooking + ' WIB.'
            };
          }
        }
      }
    }

    var fileUrl = "";
    if (form.fileData) {
      var folder = getUploadFolder();
      var contentType = form.fileData.substring(5, form.fileData.indexOf(';'));
      var bytes = Utilities.base64Decode(form.fileData.substring(form.fileData.indexOf('base64,') + 7));
      var blob = Utilities.newBlob(bytes, contentType, form.fileName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    }

    var detailInstansiAtauSeksi = (form.instansi === 'Kapanewon Depok') ? form.internalPengampu : form.instansiLainnya;
    for(var i = 0; i < schedules.length; i++) {
      var sched = schedules[i];
      sheet.appendRow([
        new Date(), idBooking, form.nama, "'" + waClean, form.instansi, 
        detailInstansiAtauSeksi || "", fileUrl, form.ruangan, form.kegiatan, 
        sched.tanggal, sched.jamMulai, sched.jamSelesai, 'Pending', form.jumlahPeserta
      ]);
    }
    
    return { success: true, message: 'Berhasil! ID: ' + idBooking + '.' };
  } catch(e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

function cariBookingUser(waInput) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Bookings');
  var vals = sheet.getDataRange().getValues();
  var waClean = waInput.replace(/[^0-9]/g, '');
  var tz = Session.getScriptTimeZone(); 
  var hasil = []; 
  
  for (var i = 1; i < vals.length; i++) { 
    var rowWa = vals[i][3].toString().replace(/[^0-9]/g, '');
    if (rowWa === waClean) { 
      var formattedDate = (vals[i][9] instanceof Date) ? Utilities.formatDate(vals[i][9], tz, "yyyy-MM-dd") : vals[i][9];
      hasil.push({ 
        row: i + 1, 
        idBooking: vals[i][1], 
        nama: vals[i][2], 
        ruangan: vals[i][7], 
        kegiatan: vals[i][8], 
        tanggal: formattedDate, 
        jamMulai: formatTimeSafe(vals[i][10], tz), 
        jamSelesai: formatTimeSafe(vals[i][11], tz), 
        status: vals[i][12] || 'Pending', 
        alasan: vals[i][14] || '',
        timestampSubmit: formatTimestampSampur(vals[i][0]),
        timestampEdit: formatTimestampSampur(vals[i][15])
      });
    } 
  } 
  return hasil; 
}

function updateBooking(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Bookings');
  var tz = Session.getScriptTimeZone();
  var statusCell = sheet.getRange(data.row, 13).getValue();
  var tipeInstansiPengguna = sheet.getRange(data.row, 5).getValue();
  
  if (statusCell !== 'Pending') {
    return { success: false, message: 'Gagal: Jadwal sudah diproses, tidak bisa diedit.' };
  }
  
  if (tipeInstansiPengguna !== 'Kapanewon Depok') {
    if (isOutsideOperationalHours(data.jamMulai, data.jamSelesai)) {
      return { success: false, message: 'Sistem Menolak Perubahan: Peminjaman tempat untuk Instansi Luar hanya diizinkan antara pukul 04:00 WIB s.d pukul 23:00 WIB.' };
    }
  }

  var existingVals = sheet.getDataRange().getValues();
  var bufferMenit = 30;
  var reqMulaiMin = timeToMinutes(data.jamMulai);
  var reqSelesaiMin = timeToMinutes(data.jamSelesai);

  for (var j = 1; j < existingVals.length; j++) {
    if ((j + 1) === parseInt(data.row)) continue;
    var exStatus = existingVals[j][12] ? existingVals[j][12].toString().toLowerCase() : '';
    var exRuangan = existingVals[j][7];
    var exTanggal = (existingVals[j][9] instanceof Date) ? Utilities.formatDate(existingVals[j][9], tz, "yyyy-MM-dd") : existingVals[j][9];
    
    if (exStatus === 'disetujui' && exRuangan === data.ruangan && exTanggal === data.tanggal) {
      var exMulai = formatTimeSafe(existingVals[j][10], tz);
      var exSelesai = formatTimeSafe(existingVals[j][11], tz);
      var exMulaiMin = timeToMinutes(exMulai);
      var exSelesaiMin = timeToMinutes(exSelesai);
      var exSelesaiWithBuffer = exSelesaiMin + bufferMenit;
      
      if (reqMulaiMin < exSelesaiWithBuffer && reqSelesaiMin > exMulaiMin) {
        var jamBisaBooking = padZero(Math.floor(exSelesaiWithBuffer / 60)) + ":" + padZero(exSelesaiWithBuffer % 60);
        return { 
          success: false, 
          message: 'Gagal Edit: ' + data.ruangan + ' sudah disetujui untuk kegiatan lain pada pukul ' + exMulai + ' s.d ' + exSelesai + ' WIB. Tempat dapat digunakan kembali mulai pukul ' + jamBisaBooking + ' WIB.'
        };
      }
    }
  }

  sheet.getRange(data.row, 8).setValue(data.ruangan);
  sheet.getRange(data.row, 9).setValue(data.kegiatan);
  sheet.getRange(data.row, 10).setValue(data.tanggal);
  sheet.getRange(data.row, 11).setValue(data.jamMulai);
  sheet.getRange(data.row, 12).setValue(data.jamSelesai);
  
  // MENCATAT WAKTU EDIT DI KOLOM P
  sheet.getRange(data.row, 16).setValue(new Date());

  return { success: true, message: 'Jadwal booking berhasil diperbarui!' };
}

function cancelBookingByRow(rowId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Bookings');
    var statusCell = sheet.getRange(rowId, 13).getValue();
    if (statusCell !== 'Pending') {
      return { success: false, message: 'Gagal: Jadwal sudah diproses oleh admin, tidak dapat dibatalkan.' };
    }
    sheet.getRange(rowId, 13).setValue('Dibatalkan');
    sheet.getRange(rowId, 16).setValue(new Date()); // Mencatat waktu pembatalan di Kolom P
    return { success: true, message: 'Permohonan jadwal berhasil dibatalkan!' };
  } catch(e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

// =================================================================
// FITUR ADMIN: GENERATOR LAPORAN BUKU REGISTER BULANAN
// =================================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🖨️ SAMPUR Admin')
      .addItem('Cetak Laporan Bulanan', 'bukaPromptLaporan')
      .addToUi();
}

function bukaPromptLaporan() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('Cetak Buku Register Bulanan', 'Masukkan bulan dan tahun yang ingin dicetak.\nFormat: MM-YYYY (Contoh: 06-2026):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() == ui.Button.OK) {
    var input = response.getResponseText().trim();
    if (!/^\d{2}-\d{4}$/.test(input)) {
      ui.alert('Format salah! Mohon gunakan format MM-YYYY.');
      return;
    }
    var parts = input.split('-');
    var bulan = parseInt(parts[0], 10);
    var tahun = parseInt(parts[1], 10);
    buatLaporanBukuRegister(bulan, tahun);
  }
}

function buatLaporanBukuRegister(bulan, tahun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetBookings = ss.getSheetByName('Bookings');
  var sheetLaporan = ss.getSheetByName('Laporan Bulanan');
  
  if (!sheetLaporan) {
    sheetLaporan = ss.insertSheet('Laporan Bulanan');
  } else {
    sheetLaporan.clear();
  }

  var valsBooking = sheetBookings.getDataRange().getValues();
  var approvedBookings = [];
  
  for (var i = 1; i < valsBooking.length; i++) {
    var statusCell = valsBooking[i][12] ? valsBooking[i][12].toString().toLowerCase() : '';
    if (statusCell === 'disetujui' && valsBooking[i][9]) {
      var tglObj = new Date(valsBooking[i][9]);
      if (tglObj.getMonth() === (bulan - 1) && tglObj.getFullYear() === tahun) {
        var jamMulai = (valsBooking[i][10] instanceof Date) ? Utilities.formatDate(valsBooking[i][10], "GMT+7", "HH:mm") : valsBooking[i][10].toString().substring(0,5);
        var jamSelesai = (valsBooking[i][11] instanceof Date) ? Utilities.formatDate(valsBooking[i][11], "GMT+7", "HH:mm") : valsBooking[i][11].toString().substring(0,5);
        
        approvedBookings.push({
          dateObj: tglObj,
          waktu: jamMulai + ' - ' + jamSelesai,
          acara: valsBooking[i][8],
          ruangan: valsBooking[i][7],
          ket: (valsBooking[i][4] === 'Kapanewon Depok') ? valsBooking[i][5] : valsBooking[i][5] + " (" + valsBooking[i][4] + ")"
        });
      }
    }
  }

  approvedBookings.sort(function(a, b) { return a.dateObj - b.dateObj; });
  
  var namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var judulLaporan = "BUKU REGISTER PEMINJAMAN RUANGAN KAPANEWON DEPOK\nBULAN " + namaBulan[bulan - 1].toUpperCase() + " TAHUN " + tahun;
  
  sheetLaporan.getRange('A1').setValue(judulLaporan).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
  
  var header = [["TANGGAL", "WAKTU", "ACARA", "TEMPAT", "KETERANGAN INSTANSI"]];
  var reportData = header.concat(approvedBookings.map(function(b) {
    return [Utilities.formatDate(b.dateObj, "GMT+7", "dd-MMM-yyyy"), b.waktu, b.acara, b.ruangan, b.ket];
  }));

  var startRowTabel = 3;
  var totalKolom = 5;
  sheetLaporan.getRange(1, 1, 1, totalKolom).mergeAcross();
  
  var rangeData = sheetLaporan.getRange(startRowTabel, 1, reportData.length, totalKolom);
  rangeData.setValues(reportData);
  rangeData.setBorder(true, true, true, true, true, true);
  rangeData.setWrap(true); 
  rangeData.setVerticalAlignment('middle');
  
  var headerRange = sheetLaporan.getRange(startRowTabel, 1, 1, totalKolom);
  headerRange.setBackground('#f3f4f6').setFontWeight('bold').setHorizontalAlignment('center');
  
  sheetLaporan.setColumnWidth(1, 100);
  sheetLaporan.setColumnWidth(2, 100);
  sheetLaporan.setColumnWidth(3, 250);
  sheetLaporan.setColumnWidth(4, 150);
  sheetLaporan.setColumnWidth(5, 200);

  SpreadsheetApp.getUi().alert('Sukses', 'Laporan berhasil dicetak ke sheet "Laporan Bulanan"!', SpreadsheetApp.getUi().ButtonSet.OK);
}