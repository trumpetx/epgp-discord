$(function() {
  $('#uploadModal').on('shown.bs.modal', function() {
    $('#uploadBackup').trigger('focus');
  });
});
