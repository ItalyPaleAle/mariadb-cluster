'use strict'

var azureVMSizes = require('./azure-vm-sizes.json')
var azureManagedDisks = require('./azure-managed-disks.json')

var formMode = false

var setFormMode = function(newMode) {
    // Reset visual state, then set the proper one
    $('[gen-role="mode"]').removeClass('active')
        .filter('[gen-mode="'+newMode+'"]').addClass('active')
    $('[gen-role="conditional-param"]').hide()
        .filter('[gen-mode="'+newMode+'"]').show()
    $('[gen-role="conditional-param"] input').prop('disabled', true)
        .filter('[gen-mode="'+newMode+'"] input').prop('disabled', false)
    $('[gen-role="conditional-param"] select').prop('disabled', true)
        .filter('[gen-mode="'+newMode+'"] select').prop('disabled', false)
    $('[gen-role="conditional-param"] textarea').prop('disabled', true)
        .filter('[gen-mode="'+newMode+'"] textarea').prop('disabled', false)
    
    // Set value
    formMode = newMode
}

var prepareFormMode = function() {
    // Add callbacks
    $('[gen-role="mode"]').on('click', function(event) {
        event.preventDefault()
        
        setFormMode($(this).attr('gen-mode'))
    })
}

var dataDiskUpdate = function(sizeName) {
    // Maximum number of data disks, limited to 40
    var max = 2
    var size = azureVMSizes[sizeName]
    if(size && size.disks) {
        max = size.disks
    }
    if(max > 40) {
        max = 40
    }
    
    // Add options
    var $dataDiskSelect = $('#data-disks')
    $dataDiskSelect.empty()
    for(var i = 2; i <= max; i++) {
        $dataDiskSelect.append('<option value="'+i+'">'+i+'</option>')
    }
    
    // Set value to the maximum one
    $dataDiskSelect.val(max)
}

var nodeSize = function() {
    // Populate all nodes in the select
    var $nodeSizeSelect = $('#node-size')
    for(var k in azureVMSizes) {
        if(azureVMSizes.hasOwnProperty(k)) {
            $nodeSizeSelect.append('<option value="'+k+'">'+k+'</option>')
        }
    }
    
    // Bind action to change event, to update select for data disk count
    $nodeSizeSelect.on('change', function() {
        dataDiskUpdate($nodeSizeSelect.val())
    })
    
    // Initial population of data disk count
    dataDiskUpdate($nodeSizeSelect.val())
}

var diskTypeUpdate = function(diskType) {
    // Check if disk is managed or unmanaged
    var isManaged = (diskType != 'unmanaged-standard')

    // Show or hide storage account prefix field
    if(isManaged) {
        $('#storage-account-prefix-container').hide()
    }
    else {
        $('#storage-account-prefix-container').show()
    }

    // Update the IOPS label
    var iops
    if(isManaged) {
        iops = azureManagedDisks[diskType].iops
    }
    else {
        iops = 500
    }
    $('#iops').text(iops)
}

var managedDiskSizes = function() {
    // Populate all managed disk sizes
    var $diskType = $('#disk-type')
    var $list = $('#managed-disk-list')
    for(var k in azureManagedDisks) {
        if(azureManagedDisks.hasOwnProperty(k)) {
            var label = azureManagedDisks[k].sku
            if(azureManagedDisks[k].type == 'premium') {
                label += ' Premium'
            }
            else {
                label += ' Standard'
            }

            label += ' ('+azureManagedDisks[k].size+' GB)'

            $list.append('<option value="'+k+'">'+label+'</option>')
        }
    }

    // Bind action to change event
    $diskType.on('change', function() {
        diskTypeUpdate($diskType.val())
    })
    
    // Initial action
    diskTypeUpdate($diskType.val())
}

var formSubmit = function(done, click) {
    var $form = $('#generator-form')
    $form.submit(function(event) {
        // Prevent submission
        event.preventDefault()
        
        // Remove error messages from all groups
        $('.form-group').removeClass('has-error')
        
        // Collect all values and make sure they're correct
        var formValues = {
            mode: formMode
        }
        
        // For mode ARM
        if(formMode == 'arm') {
            // Number of nodes
            var $nodeCount = $('#node-count', $form)
            formValues.nodeCount = parseInt($nodeCount.val())
            if(!(~[3,5].indexOf(formValues.nodeCount))) {
                $nodeCount.parents('.form-group').addClass('has-error')
                return false
            }
            
            // Node size
            var $nodeSize = $('#node-size', $form)
            formValues.nodeSize = $nodeSize.val() + ''
            if(!(~Object.keys(azureVMSizes).indexOf(formValues.nodeSize))) {
                $nodeSize.parents('.form-group').addClass('has-error')
                return false
            }
            
            // Data disks
            var $dataDisks = $('#data-disks', $form)
            formValues.dataDisks = parseInt($dataDisks.val())
            if(formValues.dataDisks < 2 || formValues.dataDisks > azureVMSizes[formValues.nodeSize].disks || formValues.dataDisks > 40) {
                $dataDisks.parents('.form-group').addClass('has-error')
                return false
            }
            
            // Storage account name prefix
            var $storageAccountPrefix = $('#storage-account-prefix', $form)
            formValues.storageAccountPrefix = ($storageAccountPrefix.val() + '').trim()
            if(!formValues.storageAccountPrefix.match(/^[0-9a-z]{1,7}$/)) {
                $storageAccountPrefix.parents('.form-group').addClass('has-error')
                return false
            }
            
            // SSH key
            var $sshKey = $('#ssh-key', $form)
            formValues.sshKey = ($sshKey.val() + '').trim()
            if(!formValues.sshKey.match(/^ssh-(rsa|dss) AAAA[0-9A-Za-z+/]+[=]{0,3}/)) {
                $sshKey.parents('.form-group').addClass('has-error')
                return false
            }
            
            // Admin username
            var $adminUsername = $('#admin-username', $form)
            formValues.adminUsername = ($adminUsername.val() + '').trim()
            if(!formValues.adminUsername.match(/^[a-z_][a-z0-9_-]*$/)) {
                $adminUsername.parents('.form-group').addClass('has-error')
                return false
            }
        }
        else if(formMode == 'cloudconfig') {
            // vCPU count
            var $vcpuCount = $('#vcpu-count', $form)
            formValues.vcpuCount = parseInt($vcpuCount.val())
            if(formValues.vcpuCount < 0 || formValues.vcpuCount > 32) {
                $vcpuCount.parents('.form-group').addClass('has-error')
                return false
            }
            
            // etcd2 node count
            var $etcdNodeCount = $('#etcd-node-count', $form)
            formValues.etcdNodeCount = parseInt($etcdNodeCount.val())
            if(formValues.etcdNodeCount < 1) {
                $etcdNodeCount.parents('.form-group').addClass('has-error')
                return false
            }
        }
        
        // etcd discovery URL
        var $discoveryUrl = $('#etcd-discovery-url', $form)
        formValues.discoveryUrl = ($discoveryUrl.val() + '').trim()
        if(!formValues.discoveryUrl) {
            // Empty = auto-generate
            formValues.discoveryUrl = false
        }
        else if(!formValues.discoveryUrl.match(/^https\:\/\/discovery\.etcd\.io\/[a-f0-9]{32}$/)) {
            $discoveryUrl.parents('.form-group').addClass('has-error')
            return false
        }
        
        // Invoke click callback if necessary
        if(click) {
            click()
        }
        
        // Invoke callback
        if(done) {
            done(formValues)
        }
        
        // Prevent submission
        return false
    })
}

module.exports = {
    prepareFormMode: prepareFormMode,
    setFormMode: setFormMode,
    nodeSize: nodeSize,
    managedDiskSizes: managedDiskSizes,
    formSubmit: formSubmit
}
